const { body, param, query } = require("express-validator");

const createSellerCustomerReviewValidator = [
  body("orderId").isUUID().withMessage("Invalid order ID"),
  body("rating")
    .exists()
    .withMessage("rating is required")
    .isInt({ min: 1, max: 5 })
    .withMessage("rating must be an integer between 1 and 5"),
  body("comment")
    .optional({ nullable: true })
    .isString()
    .withMessage("comment must be a string")
    .isLength({ max: 2000 })
    .withMessage("comment must be at most 2000 characters"),
];

const updateSellerCustomerReviewValidator = [
  param("id").isUUID().withMessage("Invalid review ID"),
  body("rating")
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage("rating must be an integer between 1 and 5"),
  body("comment")
    .optional({ nullable: true })
    .isString()
    .withMessage("comment must be a string")
    .isLength({ max: 2000 })
    .withMessage("comment must be at most 2000 characters"),
];

const sellerCustomerReviewIdParamValidator = [
  param("id").isUUID().withMessage("Invalid review ID"),
];

const getCustomerSellerReviewsValidator = [
  param("customerId").isUUID().withMessage("Invalid customer ID"),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer")
    .toInt(),
];

const getMySellerCustomerReviewsValidator = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer")
    .toInt(),
];

const getSellerCustomerReviewsBySellerValidator = [
  param("sellerId").isUUID().withMessage("Invalid seller ID"),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer")
    .toInt(),
];

module.exports = {
  createSellerCustomerReviewValidator,
  updateSellerCustomerReviewValidator,
  sellerCustomerReviewIdParamValidator,
  getCustomerSellerReviewsValidator,
  getMySellerCustomerReviewsValidator,
  getSellerCustomerReviewsBySellerValidator,
};
