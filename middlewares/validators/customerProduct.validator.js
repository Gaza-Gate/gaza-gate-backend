const { query, param } = require("express-validator");

const SORT_VALUES = ["price_asc", "price_desc", "newest", "rating"];

const getAllProductsPublicValidator = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer")
    .toInt(),

  query("minPrice")
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage("minPrice must be a positive number")
    .toFloat(),

  query("maxPrice")
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage("maxPrice must be a positive number")
    .toFloat(),

  query("categoryId")
    .optional()
    .isUUID()
    .withMessage("categoryId must be a valid UUID"),

  query("sort")
    .optional()
    .isIn(SORT_VALUES)
    .withMessage(`sort must be one of: ${SORT_VALUES.join(", ")}`),
];

const getProductDetailsPublicValidator = [
  param("id").isUUID().withMessage("Invalid product ID"),
];

module.exports = {
  getAllProductsPublicValidator,
  getProductDetailsPublicValidator,
};
