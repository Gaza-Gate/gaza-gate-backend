const reviewService = require("../../services/review/review.service.js");
const sellerCustomerReviewService = require("../../services/review/sellerCustomerReview.service.js");
const apiResponse = require("../../utils/http/apiResponse.util.js");
const asyncWrapper = require("../../utils/http/asyncWrapper.util.js");

const createReview = asyncWrapper(async (req, res) => {
  const review = await reviewService.createReview(req);
  return apiResponse.sendSuccess(res, review, 201);
});

const getMyReviews = asyncWrapper(async (req, res) => {
  const data = await reviewService.getMyReviews(req);
  return apiResponse.sendSuccess(res, data, 200);
});

const getMyReceivedSellerReviews = asyncWrapper(async (req, res) => {
  const data = await sellerCustomerReviewService.getMyReceivedSellerReviews(
    req,
  );
  return apiResponse.sendSuccess(res, data, 200);
});

const updateReview = asyncWrapper(async (req, res) => {
  const review = await reviewService.updateReview(req);
  return apiResponse.sendSuccess(res, review, 200);
});

const deleteReview = asyncWrapper(async (req, res) => {
  const result = await reviewService.deleteReview(req);
  return apiResponse.sendSuccess(res, result, 200);
});

module.exports = {
  createReview,
  getMyReviews,
  getMyReceivedSellerReviews,
  updateReview,
  deleteReview,
};
