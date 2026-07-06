const { body, query, param } = require("express-validator");

const startConversationValidator = [
  body("sellerId").optional().isUUID().withMessage("Invalid seller ID"),
  body("productId").optional().isUUID().withMessage("Invalid product ID"),
  body("orderId").optional().isUUID().withMessage("Invalid order ID"),
  body().custom((_, { req }) => {
    const { sellerId, productId, orderId } = req.body || {};
    if (!sellerId && !productId && !orderId) {
      throw new Error(
        "At least one of sellerId, productId, or orderId is required.",
      );
    }
    return true;
  }),
];

const conversationIdParam = [
  param("conversationId").isUUID().withMessage("Invalid conversation ID"),
];

const messageIdParam = [
  param("messageId").isUUID().withMessage("Invalid message ID"),
];

const updateMessageValidator = [
  body("content")
    .exists()
    .withMessage("content is required")
    .isString()
    .withMessage("content must be a string")
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage("content must be between 1 and 5000 characters"),
];

const sendMessageValidator = [
  body("content")
    .exists()
    .withMessage("content is required")
    .isString()
    .withMessage("content must be a string")
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage("content must be between 1 and 5000 characters"),
  body("productId").optional().isUUID().withMessage("Invalid product ID"),
];

const listConversationsValidator = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
];

const getConversationValidator = [
  ...conversationIdParam,
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
];

module.exports = {
  startConversationValidator,
  conversationIdParam,
  messageIdParam,
  sendMessageValidator,
  updateMessageValidator,
  listConversationsValidator,
  getConversationValidator,
};
