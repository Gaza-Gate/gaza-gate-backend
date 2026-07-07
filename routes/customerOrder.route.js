const router = require("express").Router();
const controller = require("../controllers/customerOrder.controller.js");
const authenticateAccessToken = require("../middlewares/auth/verifyToken.middleware.js");
const requestsValidator = require("../middlewares/validators/request.validator.js");
const {
  createOrderValidator,
  getOrdersValidator,
  orderIdValidator,
} = require("../middlewares/validators/customerOrder.validator.js");
const AppError = require("../utils/AppError.util.js");

const ensureCustomerAccess = (req, res, next) => {
  if (req.user?.role !== "customer") {
    return next(AppError.fail("Access denied.", 403));
  }
  next();
};

router.post(
  "/",
  authenticateAccessToken,
  ensureCustomerAccess,
  createOrderValidator,
  requestsValidator,
  controller.createOrder,
);
router.get(
  "/",
  authenticateAccessToken,
  ensureCustomerAccess,
  getOrdersValidator,
  requestsValidator,
  controller.getCustomerOrders,
);
router.get(
  "/:orderId",
  authenticateAccessToken,
  ensureCustomerAccess,
  orderIdValidator,
  requestsValidator,
  controller.getCustomerOrderDetails,
);
router.patch(
  "/:orderId/cancel",
  authenticateAccessToken,
  ensureCustomerAccess,
  orderIdValidator,
  requestsValidator,
  controller.cancelOrder,
);

module.exports = router;
