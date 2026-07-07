const asyncWrapper = require("../utils/asyncWrapper.util.js");
const apiResponse = require("../utils/apiResponse.util.js");
const wishlistService = require("../services/wishlist.service.js");

const getWishlist = asyncWrapper(async (req, res) => {
  const result = await wishlistService.getWishlist(req);
  return apiResponse.sendSuccess(res, result, 200);
});

const addToWishlist = asyncWrapper(async (req, res) => {
  const item = await wishlistService.addToWishlist(req);
  return apiResponse.sendSuccess(res, { item }, 201);
});

const removeFromWishlist = asyncWrapper(async (req, res) => {
  const result = await wishlistService.removeFromWishlist(req);
  return apiResponse.sendSuccess(res, result, 200);
});

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
};
