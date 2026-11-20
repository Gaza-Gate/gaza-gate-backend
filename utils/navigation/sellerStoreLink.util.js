const TRUSTED_MIN_RATING = 4.5;
const TRUSTED_MIN_RATING_COUNT = 10;
const TRUSTED_MIN_COMPLETED_ORDERS = 10;
const TRUSTED_MIN_COMPLETION_RATE = 90;

// Public storefront route on the frontend.
//   - store has a slug  → "/store/<slug>"         (gazagate.store/store/gift-store)
//   - no slug yet       → "/customer/store/<id>"  (stores created before slugs)
// Both id links ("/store/<id>", "/customer/store/<id>") keep working forever:
// printed QR codes use them.
//
// Accepts a seller object ({ id, slug }) or (sellerId, slug).
const buildSellerStoreActionUrl = (sellerOrId, slug = null) => {
  const id = typeof sellerOrId === "object" ? sellerOrId?.id : sellerOrId;
  const storeSlug = typeof sellerOrId === "object" ? sellerOrId?.slug : slug;
  if (storeSlug) return `/store/${storeSlug}`;
  if (!id) return null;
  return `/customer/store/${id}`;
};

const computeIsTrustedSeller = ({
  rating = 0,
  ratingCount = 0,
  completedOrders = 0,
  completionRate = 0,
} = {}) => {
  const avg = Number(rating) || 0;
  const count = Number(ratingCount) || 0;
  const completed = Number(completedOrders) || 0;
  const rate = Number(completionRate) || 0;

  return (
    avg >= TRUSTED_MIN_RATING &&
    count >= TRUSTED_MIN_RATING_COUNT &&
    completed >= TRUSTED_MIN_COMPLETED_ORDERS &&
    rate >= TRUSTED_MIN_COMPLETION_RATE
  );
};

const mapSellerSummary = (seller, user = null, orderTrust = null) => {
  if (!seller?.id) return null;

  const avatarUser = user ?? seller.user ?? null;
  const completedOrders =
    orderTrust?.completedOrders ?? seller.completedOrders ?? 0;
  const completionRate =
    orderTrust?.completionRate ?? seller.completionRate ?? 0;

  return {
    id: seller.id,
    storeName: seller.storeName,
    avatar: avatarUser?.avatar ?? null,
    slug: seller.slug ?? null,
    actionUrl: buildSellerStoreActionUrl(seller),
    isTrustedSeller: computeIsTrustedSeller({
      rating: seller.rating,
      ratingCount: seller.ratingCount,
      completedOrders,
      completionRate,
    }),
  };
};

module.exports = {
  TRUSTED_MIN_RATING,
  TRUSTED_MIN_RATING_COUNT,
  TRUSTED_MIN_COMPLETED_ORDERS,
  TRUSTED_MIN_COMPLETION_RATE,
  buildSellerStoreActionUrl,
  computeIsTrustedSeller,
  mapSellerSummary,
};
