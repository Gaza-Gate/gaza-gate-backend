const router = require("express").Router();
const reviewController = require("../../controllers/seller/review.controller.js");
const authenticateAccessToken = require("../../middlewares/auth/verifyToken.middleware.js");
const requestsValidator = require("../../middlewares/validators/request.validator.js");
const upload = require("../../middlewares/upload/imageUpload.middleware.js");
const {
  createReviewValidator,
} = require("../../middlewares/validators/review.validator.js");
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

module.exports = router;
