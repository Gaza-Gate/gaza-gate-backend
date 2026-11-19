const router = require("express").Router();
const controller = require("../../controllers/customer/order.controller.js");
const authenticateAccessToken = require("../../middlewares/auth/verifyToken.middleware.js");
const allowedTo = require("../../middlewares/auth/allowedTo.middleware.js");
const USER_ROLES = require("../../constants/user/userRoles.constant.js");

router.get(
  "/",
  authenticateAccessToken,
  allowedTo(USER_ROLES.SELLER),
  controller.getSellerOrders,
);
router.get(
  "/:id",
  authenticateAccessToken,
  allowedTo(USER_ROLES.SELLER),
  controller.getOrderDetails,
);
router.patch(
  "/:id/status",
  authenticateAccessToken,
  allowedTo(USER_ROLES.SELLER),
  controller.updateOrderStatus,
);
router.patch(
  "/:id/reject",
  authenticateAccessToken,
  allowedTo(USER_ROLES.SELLER),
  controller.rejectOrder,
);

module.exports = router;
