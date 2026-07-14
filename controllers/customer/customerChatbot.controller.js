const chatbotService = require("../../services/ai/chatbot/chatbot.service.js");
const apiResponse = require("../../utils/http/apiResponse.util.js");
const asyncWrapper = require("../../utils/http/asyncWrapper.util.js");

const askQuestion = asyncWrapper(async (req, res) => {
  const result = await chatbotService.askQuestion(
    req.user.id,
    req.body.question,
  );

  return apiResponse.sendSuccess(res, result, 200);
});

module.exports = {
  askQuestion,
};
