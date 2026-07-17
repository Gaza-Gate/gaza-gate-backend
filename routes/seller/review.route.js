const router = require("express").Router();
const reviewController = require("../../controllers/seller/review.controller");
const authenticateAccessToken = require("../../middlewares/auth/verifyToken.middleware");
const allowedTo = require("../../middlewares/auth/allowedTo.middleware.js");
const USER_ROLES = require("../../constants/user/userRoles.constant.js");

router.get(
  "/",
  authenticateAccessToken,
  allowedTo(USER_ROLES.SELLER),
  reviewController.getSellerReviews,
);

module.exports = router;
