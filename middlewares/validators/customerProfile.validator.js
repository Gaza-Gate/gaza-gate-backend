const { body, param } = require("express-validator");

const updateCustomerProfileValidator = [
  body("email").not().exists().withMessage("Email cannot be updated"),

  body("firstName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("First name cannot be empty")
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters"),

  body("lastName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Last name cannot be empty")
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must be between 2 and 50 characters"),

  body("phone")
    .optional()
    .trim()
    .isLength({ min: 2, max: 20 })
    .withMessage("Phone number must be between 2 and 20 characters"),

  body("gender")
    .optional()
    .isIn(["male", "female", "other"])
    .withMessage('Gender must be "male", "female" or "other"'),

  body("birthDate")
    .optional()
    .isISO8601()
    .withMessage("Birth date must be a valid date (YYYY-MM-DD)")
    .toDate(),
];

const addAddressValidator = [
  body("neighborhood")
    .trim()
    .notEmpty()
    .withMessage("Neighborhood is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Neighborhood must be between 2 and 100 characters"),

  body("street")
    .trim()
    .notEmpty()
    .withMessage("Street is required")
    .isLength({ min: 2, max: 255 })
    .withMessage("Street must be between 2 and 255 characters"),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes must not exceed 500 characters"),
];

const updateAddressValidator = [
  param("addressId").isUUID().withMessage("Invalid address ID"),

  body("neighborhood")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Neighborhood cannot be empty")
    .isLength({ min: 2, max: 100 })
    .withMessage("Neighborhood must be between 2 and 100 characters"),

  body("street")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Street cannot be empty")
    .isLength({ min: 2, max: 255 })
    .withMessage("Street must be between 2 and 255 characters"),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes must not exceed 500 characters"),
];

const addressIdValidator = [
  param("addressId").isUUID().withMessage("Invalid address ID"),
];

module.exports = {
  updateCustomerProfileValidator,
  addAddressValidator,
  updateAddressValidator,
  addressIdValidator,
};
