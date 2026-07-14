const router = require("express").Router();
const wishlistController = require("../../controllers/customer/wishlist.controller.js");
const authenticateAccessToken = require("../../middlewares/auth/verifyToken.middleware.js");

router.get("/", authenticateAccessToken, wishlistController.getWishlist);
router.post("/", authenticateAccessToken, wishlistController.addToWishlist);
router.delete(
  "/:productId",
  authenticateAccessToken,
  wishlistController.removeFromWishlist,
);

module.exports = router;
