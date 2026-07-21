const reviewService = require("../../services/review/review.service.js");
const sellerCustomerReviewService = require("../../services/review/sellerCustomerReview.service.js");
const apiResponse = require("../../utils/http/apiResponse.util.js");
const asyncWrapper = require("../../utils/http/asyncWrapper.util.js");

const getSellerReviews = asyncWrapper(async (req, res) => {
  const reviews = await reviewService.getSellerReviews(req.user.id, req.query);
  return apiResponse.sendSuccess(res, reviews, 200);
});

const createSellerCustomerReview = asyncWrapper(async (req, res) => {
  const review = await sellerCustomerReviewService.createSellerCustomerReview(
    req,
  );
  return apiResponse.sendSuccess(res, review, 201);
});

const updateSellerCustomerReview = asyncWrapper(async (req, res) => {
  const review = await sellerCustomerReviewService.updateSellerCustomerReview(
    req,
  );
  return apiResponse.sendSuccess(res, review, 200);
});

const deleteSellerCustomerReview = asyncWrapper(async (req, res) => {
  const result = await sellerCustomerReviewService.deleteSellerCustomerReview(
    req,
  );
  return apiResponse.sendSuccess(res, result, 200);
});

const getMySellerCustomerReviews = asyncWrapper(async (req, res) => {
  const data = await sellerCustomerReviewService.getMySellerCustomerReviews(
    req,
  );
  return apiResponse.sendSuccess(res, data, 200);
});

module.exports = {
  getSellerReviews,
  createSellerCustomerReview,
  updateSellerCustomerReview,
  deleteSellerCustomerReview,
  getMySellerCustomerReviews,
};
