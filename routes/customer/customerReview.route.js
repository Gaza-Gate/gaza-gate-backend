const router = require("express").Router();
const reviewController = require("../../controllers/customer/review.controller.js");
const authenticateAccessToken = require("../../middlewares/auth/verifyToken.middleware.js");
const requestsValidator = require("../../middlewares/validators/request.validator.js");
const upload = require("../../middlewares/upload/imageUpload.middleware.js");
const {
  createReviewValidator,
  updateReviewValidator,
  reviewIdParamValidator,
  getMyReviewsValidator,
} = require("../../middlewares/validators/review.validator.js");
const {
  getMySellerCustomerReviewsValidator,
} = require("../../middlewares/validators/sellerCustomerReview.validator.js");
const AppError = require("../../utils/http/AppError.util.js");

const ensureCustomerAccess = (req, res, next) => {
  if (req.user?.role !== "customer") {
    return next(AppError.fail("Access denied.", 403));
  }
  next();
};

router.post(
  "/",
  authenticateAccessToken,
  ensureCustomerAccess,
  upload(1).single("image"),
  createReviewValidator,
  requestsValidator,
  reviewController.createReview,
);

router.get(
  "/my",
  authenticateAccessToken,
  ensureCustomerAccess,
  getMyReviewsValidator,
  requestsValidator,
  reviewController.getMyReviews,
);

router.get(
  "/from-sellers",
  authenticateAccessToken,
  ensureCustomerAccess,
  getMySellerCustomerReviewsValidator,
  requestsValidator,
  reviewController.getMyReceivedSellerReviews,
);

router.patch(
  "/:id",
  authenticateAccessToken,
  ensureCustomerAccess,
  upload(1).single("image"),
  updateReviewValidator,
  requestsValidator,
  reviewController.updateReview,
);

router.delete(
  "/:id",
  authenticateAccessToken,
  ensureCustomerAccess,
  reviewIdParamValidator,
  requestsValidator,
  reviewController.deleteReview,
);

module.exports = router;
