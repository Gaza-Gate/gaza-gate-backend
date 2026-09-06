const asyncWrapper = require("../../utils/http/asyncWrapper.util.js");
const apiResponse = require("../../utils/http/apiResponse.util.js");
const customerOrderService = require("../../services/order/customerOrder.service.js");

const createOrder = asyncWrapper(async (req, res) => {
  const result = await customerOrderService.createOrder(req);
  return apiResponse.sendSuccess(res, result, 201);
});

const getCustomerOrders = asyncWrapper(async (req, res) => {
  const result = await customerOrderService.getCustomerOrders(req);
  return apiResponse.sendSuccess(res, result, 200);
});

const getCustomerOrderDetails = asyncWrapper(async (req, res) => {
  const result = await customerOrderService.getCustomerOrderDetails(req);
  return apiResponse.sendSuccess(res, result, 200);
});

const cancelOrder = asyncWrapper(async (req, res) => {
  const result = await customerOrderService.cancelOrder(req);
  return apiResponse.sendSuccess(res, result, 200);
});

module.exports = {
  createOrder,
  getCustomerOrders,
  getCustomerOrderDetails,
  cancelOrder,
};
