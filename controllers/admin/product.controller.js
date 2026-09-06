const asyncWrapper = require("../../utils/http/asyncWrapper.util.js");
const apiResponse = require("../../utils/http/apiResponse.util.js");
const adminProductService = require("../../services/admin/adminProduct.service.js");

const listProductsController = asyncWrapper(async (req, res) => {
  const result = await adminProductService.getAdminProducts(req);
  return apiResponse.sendSuccess(res, result, 200);
});

const updateProductStatusController = asyncWrapper(async (req, res) => {
  const result = await adminProductService.updateProductStatus(req);
  return apiResponse.sendSuccess(res, result, 200);
});

const deleteProductController = asyncWrapper(async (req, res) => {
  const result = await adminProductService.deleteProduct(req);
  return apiResponse.sendSuccess(res, result, 200);
});

module.exports = {
  listProducts: listProductsController,
  updateProductStatus: updateProductStatusController,
  deleteProduct: deleteProductController,
};
