const router = require("express").Router();
const reviewController = require("../../controllers/seller/review.controller");
const authenticateAccessToken = require("../../middlewares/auth/verifyToken.middleware");
const allowedTo = require("../../middlewares/auth/allowedTo.middleware.js");
const requestsValidator = require("../../middlewares/validators/request.validator.js");
const USER_ROLES = require("../../constants/user/userRoles.constant.js");
const {
  createSellerCustomerReviewValidator,
  updateSellerCustomerReviewValidator,
  sellerCustomerReviewIdParamValidator,
  getMySellerCustomerReviewsValidator,
} = require("../../middlewares/validators/sellerCustomerReview.validator.js");

router.get(
  "/",
  authenticateAccessToken,
  allowedTo(USER_ROLES.SELLER),
  reviewController.getSellerReviews,
);

router.get(
  "/customer/my",
  authenticateAccessToken,
  allowedTo(USER_ROLES.SELLER),
  getMySellerCustomerReviewsValidator,
  requestsValidator,
  reviewController.getMySellerCustomerReviews,
);

router.post(
  "/customer",
  authenticateAccessToken,
  allowedTo(USER_ROLES.SELLER),
  createSellerCustomerReviewValidator,
  requestsValidator,
  reviewController.createSellerCustomerReview,
);

router.patch(
  "/customer/:id",
  authenticateAccessToken,
  allowedTo(USER_ROLES.SELLER),
  updateSellerCustomerReviewValidator,
  requestsValidator,
  reviewController.updateSellerCustomerReview,
);

router.delete(
  "/customer/:id",
  authenticateAccessToken,
  allowedTo(USER_ROLES.SELLER),
  sellerCustomerReviewIdParamValidator,
  requestsValidator,
  reviewController.deleteSellerCustomerReview,
);

module.exports = router;
