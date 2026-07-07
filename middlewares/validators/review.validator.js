const { body } = require("express-validator");

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
];

module.exports = { createReviewValidator };
