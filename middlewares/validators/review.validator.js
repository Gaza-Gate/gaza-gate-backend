const { body, param, query } = require("express-validator");
const {
  IMAGE_MIME_TYPES,
} = require("../../constants/shared/imageMimeTypes.constants.js");

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const allowedMimeTypes = Object.values(IMAGE_MIME_TYPES);

const optionalReviewImageValidator = body().custom((_, { req }) => {
  const file = req.file;
  if (!file) return true;

  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new Error("Only JPG, JPEG, PNG and WebP images are allowed.");
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("Image must not exceed 5 MB.");
  }

  return true;
});

const createReviewValidator = [
  body("productId").isUUID().withMessage("Invalid product ID"),
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
  optionalReviewImageValidator,
];

const updateReviewValidator = [
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
  optionalReviewImageValidator,
];

const reviewIdParamValidator = [
  param("id").isUUID().withMessage("Invalid review ID"),
];

const getMyReviewsValidator = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer")
    .toInt(),
];

const getProductReviewsValidator = [
  param("productId").isUUID().withMessage("Invalid product ID"),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer")
    .toInt(),
  query("rating")
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage("rating must be an integer between 1 and 5")
    .toInt(),
];

const getSellerProductReviewsValidator = [
  param("sellerId").isUUID().withMessage("Invalid seller ID"),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer")
    .toInt(),
  query("rating")
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage("rating must be an integer between 1 and 5")
    .toInt(),
];

module.exports = {
  createReviewValidator,
  updateReviewValidator,
  reviewIdParamValidator,
  getMyReviewsValidator,
  getProductReviewsValidator,
  getSellerProductReviewsValidator,
};
