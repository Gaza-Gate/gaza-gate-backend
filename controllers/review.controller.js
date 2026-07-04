const reviewService = require("../services/review.service");
const apiResponse = require("../utils/apiResponse.util.js");
const asyncWrapper = require("../utils/asyncWrapper.util");

const createReview = asyncWrapper(async (req, res) => {
  const review = await reviewService.createReview(req);
  return apiResponse.sendSuccess(res, review, 201);
});

const getSellerReviews = asyncWrapper(async (req, res) => {
  const reviews = await reviewService.getSellerReviews(req.user.id, req.query);
  return apiResponse.sendSuccess(res, reviews, 200);
});

module.exports = { createReview, getSellerReviews };
