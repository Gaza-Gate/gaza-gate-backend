const TRUSTED_MIN_RATING = 4.5;
const TRUSTED_MIN_RATING_COUNT = 10;
const TRUSTED_MIN_COMPLETED_ORDERS = 10;
const TRUSTED_MIN_COMPLETION_RATE = 90;

const buildSellerStoreActionUrl = (sellerId) => {
  if (!sellerId) return null;
  return `/store/${sellerId}`;
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
    actionUrl: buildSellerStoreActionUrl(seller.id),
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
