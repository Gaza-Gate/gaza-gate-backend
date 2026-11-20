const { Op } = require("sequelize");
const { sequelize } = require("../../config/db.config.js");
const Seller = require("../../models/seller.model.js");
const SellerSlugHistory = require("../../models/sellerSlugHistory.model.js");
const AppError = require("../../utils/http/AppError.util.js");
const { STORE_SLUG_LIMITS } = require("../../constants/seller/storeSlug.constant.js");
const {
  isUuid,
  isValidStoreSlug,
  isReservedStoreSlug,
  normalizeStoreSlug,
  suggestStoreSlug,
  withSlugSuffix,
} = require("../../utils/navigation/storeSlug.util.js");

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A slug is taken if any store uses it now, or ever used it (history),
 * except the given store itself.
 */
const isStoreSlugTaken = async (slug, { excludeSellerId = null, transaction } = {}) => {
  const exclude = excludeSellerId ? { id: { [Op.ne]: excludeSellerId } } : {};
  const historyExclude = excludeSellerId ? { sellerId: { [Op.ne]: excludeSellerId } } : {};

  const [current, history] = await Promise.all([
    Seller.count({ where: { slug, ...exclude }, transaction }),
    SellerSlugHistory.count({ where: { slug, ...historyExclude }, transaction }),
  ]);
  return current + history > 0;
};

/**
 * First free slug for a base: "hala-beauty", "hala-beauty-2", "hala-beauty-3", ...
 */
const firstFreeSlug = async (base, options = {}) => {
  for (let n = 1; n < 1000; n += 1) {
    const candidate = withSlugSuffix(base, n);
    // eslint-disable-next-line no-await-in-loop
    if (!(await isStoreSlugTaken(candidate, options))) return candidate;
  }
  throw AppError.error("Could not generate a unique store link.");
};

/**
 * Unique slug suggested from a store name (used on store creation and backfill).
 */
const generateUniqueStoreSlug = (storeName, options = {}) =>
  firstFreeSlug(suggestStoreSlug(storeName), options);

/**
 * Finds an active-or-not seller by what is in the URL: id, current slug,
 * or an old slug. Returns { seller, matchedBy } or null.
 *
 * @param {string} storeKey - "/store/<storeKey>"
 * @param {object} findOptions - Sequelize options (attributes, include...) for Seller
 */
const findSellerByStoreKey = async (storeKey, findOptions = {}) => {
  if (!storeKey) return null;

  if (isUuid(storeKey)) {
    const seller = await Seller.findOne({ ...findOptions, where: { ...(findOptions.where || {}), id: storeKey } });
    return seller ? { seller, matchedBy: "id" } : null;
  }

  const slug = String(storeKey).toLowerCase();
  const seller = await Seller.findOne({ ...findOptions, where: { ...(findOptions.where || {}), slug } });
  if (seller) return { seller, matchedBy: "slug" };

  const old = await SellerSlugHistory.findOne({ where: { slug }, attributes: ["sellerId"] });
  if (!old) return null;
  const moved = await Seller.findOne({ ...findOptions, where: { ...(findOptions.where || {}), id: old.sellerId } });
  return moved ? { seller: moved, matchedBy: "history" } : null;
};

/**
 * When the seller can change the slug next (null = now).
 */
const nextSlugChangeAt = (slugChangedAt) => {
  if (!slugChangedAt) return null;
  const next = new Date(new Date(slugChangedAt).getTime() + STORE_SLUG_LIMITS.CHANGE_COOLDOWN_DAYS * DAY_MS);
  return next > new Date() ? next : null;
};

/**
 * Live check for the edit-store form.
 * @returns {{ slug, available, reason?, suggestion? }}
 *   reason: "invalid" | "reserved" | "taken" | "current"
 */
const checkStoreSlugAvailability = async (sellerId, rawSlug) => {
  const slug = normalizeStoreSlug(rawSlug);
  const seller = await Seller.findByPk(sellerId, { attributes: ["id", "slug", "storeName"] });
  if (!seller) throw AppError.fail("Store not found.", 404);

  if (slug === seller.slug) return { slug, available: true, reason: "current" };

  if (isReservedStoreSlug(slug)) {
    return { slug, available: false, reason: "reserved", suggestion: await firstFreeSlug(`${slug}-shop`) };
  }
  if (!isValidStoreSlug(slug)) {
    return { slug, available: false, reason: "invalid" };
  }
  if (await isStoreSlugTaken(slug, { excludeSellerId: seller.id })) {
    return { slug, available: false, reason: "taken", suggestion: await firstFreeSlug(slug, { excludeSellerId: seller.id }) };
  }
  return { slug, available: true };
};

/**
 * Seller changes their store link. The old slug goes to history so
 * /store/<old> keeps working. Allowed once per CHANGE_COOLDOWN_DAYS.
 */
const changeStoreSlug = async (sellerId, rawSlug) => {
  const slug = normalizeStoreSlug(rawSlug);
  if (!isValidStoreSlug(slug)) {
    throw AppError.fail(
      `Store link must be ${STORE_SLUG_LIMITS.MIN}-${STORE_SLUG_LIMITS.MAX} lowercase English letters, numbers or hyphens, and not a reserved word.`,
      400,
    );
  }

  return sequelize.transaction(async (transaction) => {
    const seller = await Seller.findByPk(sellerId, {
      attributes: ["id", "slug", "slugChangedAt"],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!seller) throw AppError.fail("Store not found.", 404);
    if (seller.slug === slug) return { slug, slugChangedAt: seller.slugChangedAt };

    const lockedUntil = nextSlugChangeAt(seller.slugChangedAt);
    if (lockedUntil) {
      throw AppError.fail(
        `You can change your store link again after ${lockedUntil.toISOString().split("T")[0]}.`,
        429,
      );
    }

    if (await isStoreSlugTaken(slug, { excludeSellerId: seller.id, transaction })) {
      throw AppError.fail("This store link is already taken.", 409);
    }

    if (seller.slug) {
      // ignore if this old slug is already in the store's own history
      await SellerSlugHistory.findOrCreate({
        where: { slug: seller.slug },
        defaults: { sellerId: seller.id, slug: seller.slug },
        transaction,
      });
    }
    // the store may be taking back one of its own old slugs
    await SellerSlugHistory.destroy({ where: { sellerId: seller.id, slug }, transaction });

    const slugChangedAt = new Date();
    await seller.update({ slug, slugChangedAt }, { transaction });
    return { slug, slugChangedAt };
  });
};

module.exports = {
  isStoreSlugTaken,
  generateUniqueStoreSlug,
  findSellerByStoreKey,
  nextSlugChangeAt,
  checkStoreSlugAvailability,
  changeStoreSlug,
};
