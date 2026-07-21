const AI = require("../../constants/chatbot/ai.constant.js");
const aiClient = require("./aiClient.service.js");
const sellerChatbotTools = require("./chatbot/sellerChatbotTools.service.js");
const {
  SELLER_CHATBOT_LIMITS,
  SELLER_CHATBOT_SYSTEM_PROMPT,
} = require("../../constants/chatbot/sellerChatbot.constant.js");

const buildMessages = (history, userMessage, context = {}) => {
  let systemPrompt = SELLER_CHATBOT_SYSTEM_PROMPT;
  if (context.hasProductImage) {
    systemPrompt +=
      "\n\nCURRENT SESSION: A product image is already uploaded in this chat. When the seller asks to add/create a product, call createProduct with name, price, categoryName, and stockType. Do NOT ask for imageToken or a separate image upload.";
  }

  return [
    { role: "system", content: systemPrompt },
    ...history.map((msg) => ({ role: msg.role, content: msg.content })),
    { role: "user", content: userMessage },
  ];
};

const parseToolArgs = (rawArgs) => {
  if (!rawArgs) return {};
  try {
    return JSON.parse(rawArgs);
  } catch {
    return {};
  }
};

const executeToolCalls = async (userId, toolCalls, context) => {
  const results = await Promise.all(
    toolCalls.map(async (toolCall) => {
      const toolName = toolCall.function.name;
      const args = parseToolArgs(toolCall.function.arguments);
      const result = await sellerChatbotTools.executeTool(
        userId,
        toolName,
        args,
        context,
      );

      return {
        toolCall,
        action: {
          tool: toolName,
          success: result.success !== false,
          summary: sellerChatbotTools.buildActionSummary(toolName, result),
        },
        result,
      };
    }),
  );

  return results;
};

const runAgent = async (userId, history, userMessage, context = {}) => {
  if (!aiClient.isAiEnabled()) {
    return {
      reply:
        "عذراً، خدمة المساعد الذكي غير متاحة حالياً. يرجى المحاولة لاحقاً.\nSorry, the AI assistant is currently unavailable.",
      actions: [],
      failed: true,
    };
  }

  // Use a dedicated seller model name.
  const model = AI.SELLER_CHAT_MODEL;
  const tools = sellerChatbotTools.getToolDefinitions();
  const messages = buildMessages(history, userMessage, context);
  const actions = [];
  const startMs = Date.now();

  try {
    for (let i = 0; i < SELLER_CHATBOT_LIMITS.MAX_TOOL_ITERATIONS; i++) {
      const completion = await aiClient.requestCompletion({
        model,
        temperature: AI.CHAT_TEMPERATURE,
        max_tokens: AI.SELLER_MAX_TOKENS,
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

        const toolResults = await executeToolCalls(
          userId,
          choice.tool_calls,
          context,
        );

        for (const { toolCall, action, result } of toolResults) {
          actions.push(action);
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }
        continue;
      }

      const reply =
        choice.content?.trim() || "تم تنفيذ طلبك. هل تحتاج مساعدة في شيء آخر؟";

      console.info("[ai]", {
        type: "seller_agent",
        userId,
        sessionId: context.sessionId,
        toolIterations: i + 1,
        toolsCalled: actions.map((a) => a.tool),
        latencyMs: Date.now() - startMs,
        failed: false,
      });

      return { reply, actions, failed: false };
    }

    return {
      reply:
        "تم تنفيذ بعض الإجراءات. يرجى التحقق من النتائج أو إعادة صياغة طلبك.",
      actions,
      failed: false,
    };
  } catch (error) {
    console.error("Seller AI agent error:", error.status || error.message);
    console.info("[ai]", {
      type: "seller_agent",
      userId,
      sessionId: context.sessionId,
      toolsCalled: actions.map((a) => a.tool),
      latencyMs: Date.now() - startMs,
      failed: true,
    });
    return {
      reply: aiClient.mapAiErrorReply(error),
      actions,
      failed: true,
    };
  }
};

module.exports = { runAgent };
