const sellerChatbotService = require("../../services/ai/chatbot/sellerChatbot.service.js");
const apiResponse = require("../../utils/http/apiResponse.util.js");

const chat = async (req, res) => {
  const result = await sellerChatbotService.chat(
    req.user.id,
    req.body.message,
    req.body.sessionId || null,
    req.file || null,
  );
  return apiResponse.sendSuccess(res, result, 200);
};

const uploadProductImage = async (req, res) => {
  const result = await sellerChatbotService.uploadProductImage(
    req.user.id,
    req.file,
    req.body.sessionId || null,
  );
  return apiResponse.sendSuccess(res, result, 201);
};

const getSessions = async (req, res) => {
  const result = await sellerChatbotService.getSessions(req.user.id, req.query);
  return apiResponse.sendSuccess(res, result, 200);
};

const getSessionMessages = async (req, res) => {
  const result = await sellerChatbotService.getSessionMessages(
    req.user.id,
    req.params.id,
  );
  return apiResponse.sendSuccess(res, result, 200);
};

module.exports = {
  chat,
  uploadProductImage,
  getSessions,
  getSessionMessages,
};
