const router = require("express").Router();
const cartController = require("../../controllers/customer/cart.controller.js");
const authenticateAccessToken = require("../../middlewares/auth/verifyToken.middleware.js");

router.get("/", authenticateAccessToken, cartController.getCart);
router.post("/", authenticateAccessToken, cartController.addToCart);
router.put(
  "/:cartItemId",
  authenticateAccessToken,
  cartController.updateCartItem,
);
router.delete(
  "/:cartItemId",
  authenticateAccessToken,
  cartController.removeFromCart,
);
router.delete("/", authenticateAccessToken, cartController.clearCart);

module.exports = router;
