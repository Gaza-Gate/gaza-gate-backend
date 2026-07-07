const { body, param } = require("express-validator");

const chatValidator = [
  body("message")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Message must not exceed 2000 characters")
    .custom((value, { req }) => {
      if (!value && !req.file) {
        throw new Error("Message or product image is required");
      }
      return true;
    }),
  body("sessionId")
    .optional({ values: "null" })
    .isUUID()
    .withMessage("Invalid session ID"),
];

const sessionIdParamValidator = [
  param("id").isUUID().withMessage("Invalid session ID"),
];

const uploadImageValidator = [
  body("sessionId")
    .optional({ values: "null" })
    .isUUID()
    .withMessage("Invalid session ID"),
];

module.exports = {
  chatValidator,
  sessionIdParamValidator,
  uploadImageValidator,
};
