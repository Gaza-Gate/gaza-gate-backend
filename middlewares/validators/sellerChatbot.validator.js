const { body, param } = require("express-validator");

const chatValidator = [
  // Must run even when message is missing/falsy — `.optional()` would skip a
  // chained `.custom()` and let empty chats hit Sequelize notEmpty (500).
  body("message").custom((value, { req }) => {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (!trimmed && !req.file) {
      throw new Error("Message or product image is required");
    }
    return true;
  }),
  body("message")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Message must not exceed 2000 characters"),
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
