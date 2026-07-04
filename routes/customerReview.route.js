const router = require("express").Router();
const reviewController = require("../controllers/review.controller.js");
const authenticateAccessToken = require("../middlewares/auth/verifyToken.middleware.js");
const requestsValidator = require("../middlewares/validators/request.validator.js");
const {
  createReviewValidator,
} = require("../middlewares/validators/review.validator.js");
const AppError = require("../utils/AppError.util.js");

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
  createReviewValidator,
  requestsValidator,
  reviewController.createReview,
);

module.exports = router;
