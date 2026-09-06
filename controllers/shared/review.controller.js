const reviewService = require("../../services/review/review.service.js");
const sellerCustomerReviewService = require("../../services/review/sellerCustomerReview.service.js");
const publicCustomerService = require("../../services/profile/publicCustomer.service.js");
const apiResponse = require("../../utils/http/apiResponse.util.js");
const asyncWrapper = require("../../utils/http/asyncWrapper.util.js");

const getProductReviews = asyncWrapper(async (req, res) => {
  const data = await reviewService.getProductReviews(
    req.params.productId,
    req.query,
  );
  return apiResponse.sendSuccess(res, data, 200);
});

const getCustomerSellerReviews = asyncWrapper(async (req, res) => {
  const data = await sellerCustomerReviewService.getCustomerSellerReviews(
    req.params.customerId,
    req.query,
  );
  return apiResponse.sendSuccess(res, data, 200);
});

const getCustomerProductReviews = asyncWrapper(async (req, res) => {
  const data = await publicCustomerService.getPublicCustomerReviews(
    req.params.customerId,
    req.query,
  );
  return apiResponse.sendSuccess(res, data, 200);
});

const getSellerProductReviews = asyncWrapper(async (req, res) => {
  const data = await reviewService.getSellerProductReviewsBySellerId(
    req.params.sellerId,
    req.query,
  );
  return apiResponse.sendSuccess(res, data, 200);
});

const getSellerCustomerReviews = asyncWrapper(async (req, res) => {
  const data =
    await sellerCustomerReviewService.getSellerCustomerReviewsBySellerId(
      req.params.sellerId,
      req.query,
    );
  return apiResponse.sendSuccess(res, data, 200);
});

module.exports = {
  getProductReviews,
  getCustomerSellerReviews,
  getCustomerProductReviews,
  getSellerProductReviews,
  getSellerCustomerReviews,
};
