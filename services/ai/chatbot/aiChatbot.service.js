const AI = require("../../../constants/chatbot/ai.constant.js");
const aiClient = require("../aiClient.service.js");
const { parseAiResponse } = require("../../../utils/ai/parseStructuredResponse.util.js");
const { getCustomerSystemPrompt } = require("./aiChatbotPrompt.service.js");

const askAi = async (customerQuestion) => {
  if (!aiClient.isAiEnabled()) {
    return {
      canAnswer: false,
      answer: null,
      failed: true,
      source: "ai_unavailable",
    };
  }

  // Use a dedicated customer model name.
  const model = AI.CUSTOMER_CHAT_MODEL;

  try {
    const completion = await aiClient.requestCompletion({
      model,
      temperature: AI.CHAT_TEMPERATURE,
      max_tokens: AI.CUSTOMER_MAX_TOKENS,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: getCustomerSystemPrompt() },
        { role: "user", content: customerQuestion.trim() },
      ],
    });

    const text = completion.choices?.[0]?.message?.content || "";
    const parsed = parseAiResponse(text);

    return {
      ...parsed,
      failed: false,
      source: parsed.canAnswer ? "ai" : "ai_no_match",
    };
  } catch (error) {
    console.error("AI API error:", error.message);
    return {
      canAnswer: false,
      answer: null,
      failed: true,
      source: "ai_error",
    };
  }
};

module.exports = {
  askAi,
  isAiEnabled: aiClient.isAiEnabled,
};
