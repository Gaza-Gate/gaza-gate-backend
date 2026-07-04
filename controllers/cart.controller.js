const asyncWrapper = require("../utils/asyncWrapper.util.js");
const apiResponse = require("../utils/apiResponse.util.js");
const cartService = require("../services/cart.service.js");

const getCart = asyncWrapper(async (req, res) => {
  const result = await cartService.getCart(req);
  return apiResponse.sendSuccess(res, result, 200);
});

const addToCart = asyncWrapper(async (req, res) => {
  const item = await cartService.addToCart(req);
  return apiResponse.sendSuccess(res, { item }, 201);
});

const updateCartItem = asyncWrapper(async (req, res) => {
  const item = await cartService.updateCartItem(req);
  return apiResponse.sendSuccess(res, { item }, 200);
});

const removeFromCart = asyncWrapper(async (req, res) => {
  const result = await cartService.removeFromCart(req);
  return apiResponse.sendSuccess(res, result, 200);
});

const clearCart = asyncWrapper(async (req, res) => {
  const result = await cartService.clearCart(req);
  return apiResponse.sendSuccess(res, result, 200);
});

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
};
