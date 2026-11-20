const { param, query } = require("express-validator");
const { STORE_SLUG_LIMITS } = require("../../constants/seller/storeSlug.constant.js");
const { isUuid } = require("../../utils/navigation/storeSlug.util.js");

// "/store/:sellerId" accepts the store id (old links, printed QR codes)
// or the store slug (current or old): "/store/gift-store".
const STORE_KEY_PATTERN = new RegExp(`^[a-zA-Z0-9-]{1,${STORE_SLUG_LIMITS.MAX}}$`);

const getPublicStoreValidator = [
  param("sellerId")
    .custom((value) => isUuid(value) || STORE_KEY_PATTERN.test(value))
    .withMessage("sellerId must be a store id or store link"),
];

const getStoreProductsValidator = [
  ...getPublicStoreValidator,
  query("page")
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage("Page must be an integer between 1 and 10000")
    .toInt(),
  query("sort")
    .optional()
    .isIn(["newest", "price_asc", "price_desc", "rating"])
    .withMessage("sort must be one of: newest, price_asc, price_desc, rating"),
];

module.exports = {
  getPublicStoreValidator,
  getStoreProductsValidator,
};
