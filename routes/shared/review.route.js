const router = require("express").Router();
const reviewController = require("../../controllers/shared/review.controller.js");
const authenticateAccessToken = require("../../middlewares/auth/verifyToken.middleware.js");
const requestsValidator = require("../../middlewares/validators/request.validator.js");
const {
  getProductReviewsValidator,
  getSellerProductReviewsValidator,
} = require("../../middlewares/validators/review.validator.js");
const {
  getCustomerSellerReviewsValidator,
  getSellerCustomerReviewsBySellerValidator,
} = require("../../middlewares/validators/sellerCustomerReview.validator.js");
const {
  getPublicCustomerReviewsValidator,
} = require("../../middlewares/validators/publicCustomer.validator.js");

router.get(
  "/product/:productId",
  authenticateAccessToken,
  getProductReviewsValidator,
  requestsValidator,
  reviewController.getProductReviews,
);

router.get(
  "/customer/:customerId/seller-reviews",
  authenticateAccessToken,
  getCustomerSellerReviewsValidator,
  requestsValidator,
  reviewController.getCustomerSellerReviews,
);

router.get(
  "/customer/:customerId/product-reviews",
  authenticateAccessToken,
  getPublicCustomerReviewsValidator,
  requestsValidator,
  reviewController.getCustomerProductReviews,
);

router.get(
  "/seller/:sellerId/product-reviews",
  authenticateAccessToken,
  getSellerProductReviewsValidator,
  requestsValidator,
  reviewController.getSellerProductReviews,
);

router.get(
  "/seller/:sellerId/customer-reviews",
  authenticateAccessToken,
  getSellerCustomerReviewsBySellerValidator,
  requestsValidator,
  reviewController.getSellerCustomerReviews,
);

module.exports = router;
