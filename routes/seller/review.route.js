const router = require("express").Router();
const reviewController = require("../../controllers/seller/review.controller");
const authenticateAccessToken = require("../../middlewares/auth/verifyToken.middleware");
const requestsValidator = require("../../middlewares/validators/request.validator");
const {
  replyToReviewValidator,
} = require("../../middlewares/validators/review.validator");

router.get("/", authenticateAccessToken, reviewController.getSellerReviews);

router.post(
  "/:id/reply",
  authenticateAccessToken,
  replyToReviewValidator,
  requestsValidator,
  reviewController.replyToReview,
);

module.exports = router;