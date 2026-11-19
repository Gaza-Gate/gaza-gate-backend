const { body, param, query } = require("express-validator");

const listAdminProductsValidation = [
  query("search").optional().trim().isLength({ max: 100 }),
  query("status")
    .optional()
    .isIn(["active", "hidden"])
    .withMessage("Status must be active or hidden"),
  query("categoryId").optional().isUUID(),
  query("minPrice").optional().isNumeric(),
  query("maxPrice").optional().isNumeric(),
  query("page").optional().isInt({ min: 1 }).toInt(),
];

const productIdParamValidation = [
  param("productId").isUUID().withMessage("Product ID must be a valid UUID"),
];

const updateProductStatusValidation = [
  ...productIdParamValidation,
  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn(["active", "hidden"])
    .withMessage("Status must be active or hidden"),
  body("reason")
    .if(body("status").equals("hidden"))
    .trim()
    .notEmpty()
    .withMessage("Reason is required when hiding a product.")
    .isLength({ max: 500 })
    .withMessage("Reason must be at most 500 characters"),
];

const deleteAdminProductValidation = [
  ...productIdParamValidation,
  body("reason")
    .trim()
    .notEmpty()
    .withMessage("Reason is required.")
    .isLength({ max: 500 })
    .withMessage("Reason must be at most 500 characters"),
];

module.exports = {
  listAdminProductsValidation,
  updateProductStatusValidation,
  deleteAdminProductValidation,
};
