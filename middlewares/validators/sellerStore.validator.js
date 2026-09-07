const { param, query } = require("express-validator");

const getPublicStoreValidator = [
  param("sellerId").isUUID().withMessage("sellerId must be a valid UUID"),
];

const getStoreProductsValidator = [
  ...getPublicStoreValidator,
  query("page")
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage("Page must be an integer between 1 and 10000")
    .toInt(),
  query("sort")
    .optional()
    .isIn(["newest", "price_asc", "price_desc", "rating"])
    .withMessage("sort must be one of: newest, price_asc, price_desc, rating"),
];

module.exports = {
  getPublicStoreValidator,
  getStoreProductsValidator,
};
