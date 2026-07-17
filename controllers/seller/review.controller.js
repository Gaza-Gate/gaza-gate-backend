const reviewService = require("../../services/review/review.service.js");
const apiResponse = require("../../utils/http/apiResponse.util.js");
const asyncWrapper = require("../../utils/http/asyncWrapper.util.js");

const createReview = asyncWrapper(async (req, res) => {
  const review = await reviewService.createReview(req);
  return apiResponse.sendSuccess(res, review, 201);
});

const getSellerReviews = asyncWrapper(async (req, res) => {
  const reviews = await reviewService.getSellerReviews(req.user.id, req.query);
  return apiResponse.sendSuccess(res, reviews, 200);
});

const replyToReview = asyncWrapper(async (req, res) => {
  const result = await reviewService.replyToReview(
    req.user.id,
    req.params.id,
    req.body.reply,
  );
  return apiResponse.sendSuccess(res, result, 200);
});

module.exports = { createReview, getSellerReviews, replyToReview };
