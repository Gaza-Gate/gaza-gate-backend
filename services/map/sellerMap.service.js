const Seller = require("../../models/seller.model.js");
const Address = require("../../models/address.model.js");
const AppError = require("../../utils/http/AppError.util.js");

const hasCoordinates = (seller) =>
  seller?.latitude != null && seller?.longitude != null;

const getLatestAddress = async (userId) =>
  Address.findOne({
    where: { userId },
    attributes: ["neighborhood", "street"],
    order: [["created_at", "DESC"]],
  });

const mapLocation = (seller, address) => {
  if (!hasCoordinates(seller)) return null;

  return {
    latitude: Number(seller.latitude),
    longitude: Number(seller.longitude),
    locatedAt: seller.locatedAt,
    neighborhood: address?.neighborhood ?? null,
    street: address?.street ?? null,
  };
};

const getSellerByUserId = async (userId) => {
  const seller = await Seller.findOne({ where: { userId } });
  if (!seller) {
    throw AppError.fail("No account found.", 404);
  }
  return seller;
};

const getSellerLocation = async (userId) => {
  const seller = await getSellerByUserId(userId);
  const address = await getLatestAddress(userId);
  return mapLocation(seller, address);
};

const upsertSellerLocation = async (userId, { latitude, longitude }) => {
  const seller = await getSellerByUserId(userId);
  await seller.update({
    latitude,
    longitude,
    locatedAt: new Date(),
  });
  const address = await getLatestAddress(userId);
  return mapLocation(seller, address);
};

const deleteSellerLocation = async (userId) => {
  const seller = await getSellerByUserId(userId);
  await seller.update({
    latitude: null,
    longitude: null,
    locatedAt: null,
  });
};

module.exports = {
  getSellerLocation,
  upsertSellerLocation,
  deleteSellerLocation,
};
