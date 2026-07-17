const router = require("express").Router();
const wishlistController = require("../../controllers/customer/wishlist.controller.js");
const authenticateAccessToken = require("../../middlewares/auth/verifyToken.middleware.js");
const allowedTo = require("../../middlewares/auth/allowedTo.middleware.js");
const USER_ROLES = require("../../constants/user/userRoles.constant.js");

router.get(
  "/",
  authenticateAccessToken,
  allowedTo(USER_ROLES.CUSTOMER),
  wishlistController.getWishlist,
);
router.post(
  "/",
  authenticateAccessToken,
  allowedTo(USER_ROLES.CUSTOMER),
  wishlistController.addToWishlist,
);
router.delete(
  "/:productId",
  authenticateAccessToken,
  allowedTo(USER_ROLES.CUSTOMER),
  wishlistController.removeFromWishlist,
);

module.exports = router;
