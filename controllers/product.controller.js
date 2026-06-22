const asyncWrapper = require("../utils/asyncWrapper.util.js");
const apiResponse = require("../utils/apiResponse.util");
const productService = require("../services/product.service");

const getSellerProducts = asyncWrapper(async (req, res) => {
  const products = await productService.getSellerProducts(req);
  return apiResponse.sendSuccess(res, { products }, 200);
});

const createProduct = asyncWrapper(async (req, res) => {
  const product = await productService.createProduct(req);
  return apiResponse.sendSuccess(res, { product }, 201);
});

const updateProduct = asyncWrapper(async (req, res) => {
  const product = await productService.updateProduct(req);
  return apiResponse.sendSuccess(res, { product }, 200);
});

const toggleStatus = asyncWrapper(async (req, res) => {
  const product = await productService.toggleStatus(req);
  return apiResponse.sendSuccess(res, { product }, 200);
});

const deleteProduct = asyncWrapper(async (req, res) => {
  const result = await productService.deleteProduct(req);
  return apiResponse.sendSuccess(res, result, 200);
});


module.exports = {
  getSellerProducts,
  createProduct,
  updateProduct,
  toggleStatus,
  deleteProduct,
};