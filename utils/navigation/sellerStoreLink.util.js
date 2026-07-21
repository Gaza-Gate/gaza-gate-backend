const buildSellerStoreActionUrl = (sellerId) => {
  if (!sellerId) return null;
  return `/store/${sellerId}`;
};

const mapSellerSummary = (seller, user = null) => {
  if (!seller?.id) return null;

  const avatarUser = user ?? seller.user ?? null;

  return {
    id: seller.id,
    storeName: seller.storeName,
    avatar: avatarUser?.avatar ?? null,
    actionUrl: buildSellerStoreActionUrl(seller.id),
  };
};

module.exports = {
  buildSellerStoreActionUrl,
  mapSellerSummary,
};
