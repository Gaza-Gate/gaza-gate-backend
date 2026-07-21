const OpenAI = require("openai");
const AI = require("../../constants/chatbot/ai.constant.js");
const { getApiKey } = require("../../constants/chatbot/ai.constant.js");

let client = null;

const getConfig = () => ({
  apiKey: getApiKey(),
  baseURL: AI.BASE_URL,
  model: AI.CHAT_MODEL,
});

const getClient = () => {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  if (!client) {
    client = new OpenAI({ apiKey, baseURL: AI.BASE_URL });
  }

  return client;
};

const isAiEnabled = () => Boolean(getApiKey());

const mapAiErrorReply = (error) => {
  const status = error?.status;

  if (status === 429) {
    return "عذراً، تم تجاوز حد طلبات الذكاء الاصطناعي مؤقتاً. يرجى الانتظار دقيقة ثم المحاولة مرة أخرى.\nSorry, the AI rate limit was reached. Please wait a minute and try again.";
  }

  if (status === 401 || status === 403) {
    return "عذراً، مفتاح خدمة الذكاء الاصطناعي غير صالح أو غير مصرح.\nSorry, the AI service key is invalid or unauthorized.";
  }

  if (status === 404) {
    return "عذراً، نموذج الذكاء الاصطناعي غير متاح. تحقق من إعداد AI_MODEL في الخادم.\nSorry, the configured AI model was not found.";
  }

  return "عذراً، حدث خطأ أثناء الاتصال بخدمة الذكاء الاصطناعي. يرجى المحاولة لاحقاً.\nSorry, an error occurred while contacting the AI service. Please try again later.";
};

const requestCompletion = async (params) => {
  const openaiClient = getClient();
  if (!openaiClient) {
    throw new Error("AI client is not configured.");
  }

  const maxRetries = AI.RATE_LIMIT_MAX_RETRIES ?? 4;

  // Exponential backoff for provider rate limits.
  // Some providers return `retry-after`; if present we respect it.
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await openaiClient.chat.completions.create(params);
    } catch (error) {
      const status = error?.status;
      if (status !== 429 || attempt >= maxRetries) {
        throw error;
      }

      const retryAfterSeconds =
        error?.response?.headers?.["retry-after"] ??
        error?.headers?.["retry-after"];

      const retryAfterMs = retryAfterSeconds
        ? Number(retryAfterSeconds) * 1000
        : AI.RATE_LIMIT_RETRY_MS * Math.pow(2, attempt);

      // Add small jitter to avoid retry storms.
      const jitterMs = Math.floor(Math.random() * 250);
      await new Promise((resolve) => setTimeout(resolve, retryAfterMs + jitterMs));
    }
  }
};

module.exports = {
  getConfig,
  getClient,
  isAiEnabled,
  mapAiErrorReply,
  requestCompletion,
};
