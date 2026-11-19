const { body, param, query } = require("express-validator");
const {
  CONTACT_PHONE_PATTERN,
  CONTACT_DIRECTORY_LIMITS,
  CONTACT_DIRECTORY_WRITABLE_FIELDS,
} = require("../../constants/contactDirectory/contactDirectory.constant.js");

const writableFieldSet = new Set(CONTACT_DIRECTORY_WRITABLE_FIELDS);

const idParam = param("id")
  .isUUID()
  .withMessage("Contact ID must be a valid UUID");

const requiredPhone = body("phone")
  .exists({ values: "null" })
  .withMessage("Phone is required")
  .trim()
  .notEmpty()
  .withMessage("Phone cannot be empty")
  .matches(CONTACT_PHONE_PATTERN)
  .withMessage("Phone number must be a valid Palestinian mobile number");

const optionalPhone = body("phone")
  .optional()
  .trim()
  .notEmpty()
  .withMessage("Phone cannot be empty")
  .matches(CONTACT_PHONE_PATTERN)
  .withMessage("Phone number must be a valid Palestinian mobile number");

const createContactDirectoryValidation = [
  body("deliveryName")
    .exists({ values: "null" })
    .withMessage("deliveryName is required")
    .trim()
    .notEmpty()
    .withMessage("deliveryName cannot be empty")
    .isLength({ max: CONTACT_DIRECTORY_LIMITS.DELIVERY_NAME_MAX })
    .withMessage(
      `deliveryName must be at most ${CONTACT_DIRECTORY_LIMITS.DELIVERY_NAME_MAX} characters`,
    ),
  requiredPhone,
];

const updateContactDirectoryValidation = [
  idParam,
  body().custom((_, { req }) => {
    const keys = Object.keys(req.body ?? {});
    if (keys.length === 0) {
      throw new Error("Request body cannot be empty");
    }
    const unsupported = keys.filter((key) => !writableFieldSet.has(key));
    if (unsupported.length) {
      throw new Error(`Unsupported fields: ${unsupported.join(", ")}`);
    }
    return true;
  }),
  body("deliveryName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("deliveryName cannot be empty")
    .isLength({ max: CONTACT_DIRECTORY_LIMITS.DELIVERY_NAME_MAX })
    .withMessage(
      `deliveryName must be at most ${CONTACT_DIRECTORY_LIMITS.DELIVERY_NAME_MAX} characters`,
    ),
  optionalPhone,
];

const listContactDirectoryValidation = [
  query("page").optional().isInt({ min: 1 }).toInt(),
];

const contactIdParamValidation = [idParam];

module.exports = {
  createContactDirectoryValidation,
  updateContactDirectoryValidation,
  listContactDirectoryValidation,
  contactIdParamValidation,
};
