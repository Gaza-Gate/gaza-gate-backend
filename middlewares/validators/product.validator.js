const { body } = require("express-validator");
const STOCK_TYPES = require("../../constants/stockType.constants.js");
const PRODUCT_STATUS = require("../../constants/productStatus.constants.js");

const createProductValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Product name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Product name must be between 2 and 100 characters"),
  body("price")
    .notEmpty()
    .withMessage("Price is required")
    .isFloat({ min: 0.01 })
    .withMessage("Price must be greater than zero")
    .toFloat(),
  body("categoryId")
    .notEmpty()
    .withMessage("Category is required")
    .isUUID()
    .withMessage("Invalid category ID"),
  body("stockType")
    .notEmpty()
    .withMessage("Stock type is required")
    .isIn(Object.values(STOCK_TYPES))
    .withMessage("Invalid stock type"),
  body("quantity").custom((value, { req }) => {
    const stockType = req.body.stockType;
    if (stockType === STOCK_TYPES.LIMITED) {
      if (value === undefined || value === null || value === "") {
        throw new Error("Quantity is required when stock type is LIMITED");
      }
      if (!Number.isInteger(Number(value)) || Number(value) < 0) {
        throw new Error("Quantity must be zero or greater");
      }
    }

    if (stockType === STOCK_TYPES.UNLIMITED && value !== undefined && value !== null && value !== "") {
      throw new Error("Quantity must not be provided when stock type is UNLIMITED");
    }

    return true;
  }),
  body("status")
    .optional()
    .isIn(Object.values(PRODUCT_STATUS))
    .withMessage("Invalid status"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description must not exceed 1000 characters"),
];

const updateProductValidator = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Product name must be between 2 and 100 characters"),
  body("price")
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage("Price must be greater than zero")
    .toFloat(),
  body("categoryId")
    .optional()
    .isUUID()
    .withMessage("Invalid category ID"),
  body("stockType")
    .optional()
    .isIn(Object.values(STOCK_TYPES))
    .withMessage("Invalid stock type"),
  body("quantity").custom((value, { req }) => {
    const stockType = req.body.stockType;

    if (stockType === STOCK_TYPES.LIMITED) {
      if (value === undefined || value === null || value === "") {
        throw new Error("Quantity is required when stock type is LIMITED");
      }
      if (!Number.isInteger(Number(value)) || Number(value) < 0) {
        throw new Error("Quantity must be zero or greater");
      }
    }

    if (stockType === STOCK_TYPES.UNLIMITED && value !== undefined && value !== null && value !== "") {
      throw new Error("Quantity must not be provided when stock type is UNLIMITED");
    }

    return true;
  }),

  body("status")
    .optional()
    .isIn(Object.values(PRODUCT_STATUS))
    .withMessage("Invalid status"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description must not exceed 1000 characters"),
];

module.exports = {
  createProductValidator,
  updateProductValidator,
};