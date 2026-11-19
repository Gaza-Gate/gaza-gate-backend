const router = require("express").Router();
const cartController = require("../../controllers/customer/cart.controller.js");
const authenticateAccessToken = require("../../middlewares/auth/verifyToken.middleware.js");
const allowedTo = require("../../middlewares/auth/allowedTo.middleware.js");
const USER_ROLES = require("../../constants/user/userRoles.constant.js");

router.get(
  "/",
  authenticateAccessToken,
  allowedTo(USER_ROLES.CUSTOMER),
  cartController.getCart,
);
router.post(
  "/",
  authenticateAccessToken,
  allowedTo(USER_ROLES.CUSTOMER),
  cartController.addToCart,
);
router.put(
  "/:cartItemId",
  authenticateAccessToken,
  allowedTo(USER_ROLES.CUSTOMER),
  cartController.updateCartItem,
);
router.delete(
  "/:cartItemId",
  authenticateAccessToken,
  allowedTo(USER_ROLES.CUSTOMER),
  cartController.removeFromCart,
);
router.delete(
  "/",
  authenticateAccessToken,
  allowedTo(USER_ROLES.CUSTOMER),
  cartController.clearCart,
);

module.exports = router;
