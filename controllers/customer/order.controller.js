const asyncWrapper = require("../../utils/http/asyncWrapper.util");
const apiResponse = require("../../utils/http/apiResponse.util");
const orderService = require("../../services/order/order.service");

const getSellerOrders = asyncWrapper(async (req, res) => {
  const result = await orderService.getSellerOrders(req);
  return apiResponse.sendSuccess(res, result, 200);
});

const getOrderDetails = asyncWrapper(async (req, res) => {
  const result = await orderService.getOrderDetails(req);
  return apiResponse.sendSuccess(res, result, 200);
});

const updateOrderStatus = asyncWrapper(async (req, res) => {
  const result = await orderService.updateOrderStatus(req);
  return apiResponse.sendSuccess(res, result, 200);
});

const rejectOrder = asyncWrapper(async (req, res) => {
  const result = await orderService.rejectOrder(req);
  return apiResponse.sendSuccess(res, result, 200);
});

module.exports = {
  getSellerOrders,
  getOrderDetails,
  updateOrderStatus,
  rejectOrder,
};
