const { param, query } = require("express-validator");

const customerIdParamValidator = [
  param("customerId").isUUID().withMessage("Invalid customer ID"),
];

const getPublicCustomerReviewsValidator = [
  ...customerIdParamValidator,
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer")
    .toInt(),
];

module.exports = {
  customerIdParamValidator,
  getPublicCustomerReviewsValidator,
};
