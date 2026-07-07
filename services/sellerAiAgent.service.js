const OpenAI = require("openai");
const sellerChatbotTools = require("./sellerChatbotTools.service.js");
const {
  SELLER_CHATBOT_LIMITS,
  SELLER_CHATBOT_SYSTEM_PROMPT,
} = require("../constants/sellerChatbot.constant.js");

const getConfig = () => ({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: process.env.AI_BASE_URL || "https://openrouter.ai/api/v1",
  model: process.env.AI_MODEL || "poolside/laguna-xs-2.1:free",
});

const getClient = () => {
  const { apiKey, baseURL } = getConfig();
  if (!apiKey) return null;
  return new OpenAI({ apiKey, baseURL });
};

const buildMessages = (history, userMessage, context = {}) => {
  let systemPrompt = SELLER_CHATBOT_SYSTEM_PROMPT;
  if (context.hasProductImage) {
    systemPrompt +=
      "\n\nCURRENT SESSION: A product image is already uploaded in this chat. When the seller asks to add/create a product, call createProduct with name, price, categoryName, and stockType. Do NOT ask for imageToken or a separate image upload.";
  }

  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map((msg) => ({ role: msg.role, content: msg.content })),
    { role: "user", content: userMessage },
  ];
  return messages;
};

const parseToolArgs = (rawArgs) => {
  if (!rawArgs) return {};
  try {
    return JSON.parse(rawArgs);
  } catch {
    return {};
  }
};

const runAgent = async (userId, history, userMessage, context = {}) => {
  const client = getClient();
  if (!client) {
    return {
      reply:
        "عذراً، خدمة المساعد الذكي غير متاحة حالياً. يرجى المحاولة لاحقاً.\nSorry, the AI assistant is currently unavailable.",
      actions: [],
      failed: true,
    };
  }

  const { model } = getConfig();
  const tools = sellerChatbotTools.getToolDefinitions();
  const messages = buildMessages(history, userMessage, context);
  const actions = [];

  for (let i = 0; i < SELLER_CHATBOT_LIMITS.MAX_TOOL_ITERATIONS; i++) {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.2,
      max_tokens: 1024,
      messages,
      tools,
      tool_choice: "auto",
    });

    const choice = completion.choices?.[0]?.message;
    if (!choice) {
      return {
        reply: "عذراً، لم أتمكن من معالجة طلبك. يرجى المحاولة مرة أخرى.",
        actions,
        failed: true,
      };
    }

    if (choice.tool_calls?.length) {
      messages.push({
        role: "assistant",
        content: choice.content || null,
        tool_calls: choice.tool_calls,
      });

      for (const toolCall of choice.tool_calls) {
        const toolName = toolCall.function.name;
        const args = parseToolArgs(toolCall.function.arguments);
        const result = await sellerChatbotTools.executeTool(
          userId,
          toolName,
          args,
          context,
        );

        actions.push({
          tool: toolName,
          success: result.success !== false,
          summary: sellerChatbotTools.buildActionSummary(toolName, result),
        });

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
      continue;
    }

    const reply =
      choice.content?.trim() ||
      "تم تنفيذ طلبك. هل تحتاج مساعدة في شيء آخر؟";

    return { reply, actions, failed: false };
  }

  return {
    reply:
      "تم تنفيذ بعض الإجراءات. يرجى التحقق من النتائج أو إعادة صياغة طلبك.",
    actions,
    failed: false,
  };
};

module.exports = { runAgent };
