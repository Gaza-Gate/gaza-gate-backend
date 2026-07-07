const router = require("express").Router();
const conversationController = require("../controllers/conversation.controller.js");
const authenticateAccessToken = require("../middlewares/auth/verifyToken.middleware.js");
const allowedTo = require("../middlewares/auth/allowedTo.middleware.js");
const filterBody = require("../middlewares/common/filterBody.middleware.js");
const requestsValidator = require("../middlewares/validators/request.validator.js");
const {
  startConversationValidator,
  conversationIdParam,
  messageIdParam,
  sendMessageValidator,
  updateMessageValidator,
  listConversationsValidator,
  getConversationValidator,
} = require("../middlewares/validators/conversation.validator.js");
const USER_ROLES = require("../constants/userRoles.constant.js");

router.get(
  "/",
  authenticateAccessToken,
  allowedTo(USER_ROLES.CUSTOMER, USER_ROLES.SELLER),
  listConversationsValidator,
  requestsValidator,
  conversationController.listConversations,
);

router.post(
  "/",
  authenticateAccessToken,
  allowedTo(USER_ROLES.CUSTOMER),
  filterBody(["sellerId", "productId", "orderId"]),
  startConversationValidator,
  requestsValidator,
  conversationController.startConversation,
);

router.get(
  "/:conversationId",
  authenticateAccessToken,
  allowedTo(USER_ROLES.CUSTOMER, USER_ROLES.SELLER),
  getConversationValidator,
  requestsValidator,
  conversationController.getConversation,
);

router.post(
  "/:conversationId/messages",
  authenticateAccessToken,
  allowedTo(USER_ROLES.CUSTOMER, USER_ROLES.SELLER),
  filterBody(["content", "productId"]),
  conversationIdParam,
  sendMessageValidator,
  requestsValidator,
  conversationController.sendMessage,
);

router.patch(
  "/:conversationId/messages/:messageId",
  authenticateAccessToken,
  allowedTo(USER_ROLES.CUSTOMER, USER_ROLES.SELLER),
  filterBody(["content"]),
  conversationIdParam,
  messageIdParam,
  updateMessageValidator,
  requestsValidator,
  conversationController.updateMessage,
);

router.delete(
  "/:conversationId/messages/:messageId",
  authenticateAccessToken,
  allowedTo(USER_ROLES.CUSTOMER, USER_ROLES.SELLER),
  conversationIdParam,
  messageIdParam,
  requestsValidator,
  conversationController.deleteMessage,
);

router.patch(
  "/:conversationId/read",
  authenticateAccessToken,
  allowedTo(USER_ROLES.CUSTOMER, USER_ROLES.SELLER),
  conversationIdParam,
  requestsValidator,
  conversationController.markAsRead,
);

module.exports = router;
