const { body } = require("express-validator");
const AI = require("../../constants/ai.constant.js");

const enhanceProductImageValidator = [
  body("prompt")
    .optional()
    .trim()
    .isLength({ max: AI.MAX_PROMPT_LENGTH })
    .withMessage(`Prompt must not exceed ${AI.MAX_PROMPT_LENGTH} characters`),
];

module.exports = { enhanceProductImageValidator };
