const router = require("express").Router();
const controller = require("../controllers/order.controller.js");
const authenticateAccessToken = require("../middlewares/auth/verifyToken.middleware.js");

router.get("/", authenticateAccessToken, controller.getSellerOrders);
router.get("/:id", authenticateAccessToken, controller.getOrderDetails);
router.patch(
  "/:id/status",
  authenticateAccessToken,
  controller.updateOrderStatus,
);
router.patch("/:id/reject", authenticateAccessToken, controller.rejectOrder);

module.exports = router;
