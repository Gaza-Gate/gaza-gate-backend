const getApiKey = () =>
  process.env.OPENAI_API_KEY ||
  process.env.AI_API_KEY ||
  process.env.GROQ_API_KEY ||
  "";

const baseUrl = (process.env.AI_BASE_URL || "https://openrouter.ai/api/v1").replace(
  /\/$/,
  "",
);

const AI = Object.freeze({
  BASE_URL: baseUrl,
  CHAT_COMPLETIONS_URL: `${baseUrl}/chat/completions`,
  // Customer and seller bots may need different model names (especially with
  // non-OpenRouter OpenAI-compatible base URLs).
  CUSTOMER_CHAT_MODEL:
    process.env.AI_CUSTOMER_CHAT_MODEL ||
    process.env.AI_CHAT_MODEL ||
    "deepseek-v4-flash",
  SELLER_CHAT_MODEL:
    process.env.AI_SELLER_CHAT_MODEL ||
    process.env.AI_CHAT_MODEL ||
    "deepseek-v4-flash",

  CHAT_MODEL: process.env.AI_CHAT_MODEL || "deepseek-v4-flash",
  IMAGE_MODEL: process.env.AI_IMAGE_MODEL || "gemini-3.1-flash-image-preview",
  CUSTOMER_MAX_TOKENS: 512,
  SELLER_MAX_TOKENS: 1024,
  CHAT_TEMPERATURE: 0.2,
  RATE_LIMIT_RETRY_MS: 2000,
  RATE_LIMIT_MAX_RETRIES: Number(process.env.AI_RATE_LIMIT_MAX_RETRIES || 4),
  REQUEST_TIMEOUT_MS: 60000,
  MAX_PROMPT_LENGTH: 1000,
  MAX_OUTPUT_TOKENS: 2048,
  SITE_IDENTITY_IMAGE_URL: process.env.SITE_IDENTITY_IMAGE_URL || "",
});

module.exports = { ...AI, getApiKey };
