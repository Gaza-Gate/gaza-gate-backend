const { body, query, param } = require("express-validator");
const ORDER_STATUSES = require("../../constants/order/orderStatuses.constant.js");

const createOrderValidator = [
  body("paymentMethod")
    .exists()
    .withMessage("paymentMethod is required")
    .isIn(["cash_on_delivery"])
    .withMessage("Only cash on delivery is available."),
];

const getOrdersValidator = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("status")
    .optional()
    .isIn(Object.values(ORDER_STATUSES))
    .withMessage("Invalid order status"),
];

const orderIdValidator = [
  param("orderId").isUUID().withMessage("Invalid order ID"),
];

module.exports = {
  createOrderValidator,
  getOrdersValidator,
  orderIdValidator,
};
