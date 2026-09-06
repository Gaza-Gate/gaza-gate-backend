const conversationService = require("../../services/conversation/conversation.service.js");
const apiResponse = require("../../utils/http/apiResponse.util.js");
const asyncWrapper = require("../../utils/http/asyncWrapper.util.js");

const listConversations = asyncWrapper(async (req, res) => {
  const data = await conversationService.listConversations(
    req.user.id,
    req.user.role,
    req.query,
  );
  return apiResponse.sendSuccess(res, data, 200);
});

const startConversation = asyncWrapper(async (req, res) => {
  const { conversation, created } = await conversationService.startConversation(
    req.user.id,
    req.user.role,
    req.body,
  );
  return apiResponse.sendSuccess(
    res,
    { conversation, created },
    created ? 201 : 200,
  );
});

const getConversation = asyncWrapper(async (req, res) => {
  const data = await conversationService.getConversation(
    req.user.id,
    req.params.conversationId,
    req.query,
  );
  return apiResponse.sendSuccess(res, data, 200);
});

const sendMessage = asyncWrapper(async (req, res) => {
  const message = await conversationService.sendMessage(
    req.user.id,
    req.params.conversationId,
    req.body,
  );
  return apiResponse.sendSuccess(res, { message }, 201);
});

const markAsRead = asyncWrapper(async (req, res) => {
  const data = await conversationService.markAsRead(
    req.user.id,
    req.params.conversationId,
  );
  return apiResponse.sendSuccess(res, data, 200);
});

const updateMessage = asyncWrapper(async (req, res) => {
  const message = await conversationService.updateMessage(
    req.user.id,
    req.params.conversationId,
    req.params.messageId,
    req.body,
  );
  return apiResponse.sendSuccess(res, { message }, 200);
});

const deleteMessage = asyncWrapper(async (req, res) => {
  const data = await conversationService.deleteMessage(
    req.user.id,
    req.params.conversationId,
    req.params.messageId,
  );
  return apiResponse.sendSuccess(res, data, 200);
});

module.exports = {
  listConversations,
  startConversation,
  getConversation,
  sendMessage,
  markAsRead,
  updateMessage,
  deleteMessage,
};
