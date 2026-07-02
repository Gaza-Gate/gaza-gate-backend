const AI = Object.freeze({
  OPENROUTER_URL: "https://openrouter.ai/api/v1/chat/completions",
  IMAGE_MODEL: "google/gemini-3.1-flash-image",
  REQUEST_TIMEOUT_MS: 60000,
  MAX_PROMPT_LENGTH: 1000,
  MAX_OUTPUT_TOKENS: 8192,
});

module.exports = AI;
