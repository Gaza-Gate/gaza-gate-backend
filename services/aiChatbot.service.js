const OpenAI = require("openai");
const fs = require("fs/promises");
const path = require("path");

const CANNOT_ANSWER_MARKER = "__CANNOT_ANSWER__";
const KNOWLEDGE_BASE_PATH = path.join(__dirname, "..", "data", "knowledgeBase.md");

const getConfig = () => ({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: process.env.AI_BASE_URL || "https://openrouter.ai/api/v1",
  model: process.env.AI_MODEL || "openai/gpt-4o-mini",
});

const getClient = () => {
  const { apiKey, baseURL } = getConfig();
  if (!apiKey) {
    return null;
  }

  return new OpenAI({ apiKey, baseURL });
};

const buildKnowledgeContext = async () => {
  try {
    const content = await fs.readFile(KNOWLEDGE_BASE_PATH, "utf-8");
    const trimmed = content.trim();
    return trimmed || "No knowledge base entries available.";
  } catch (error) {
    console.error("Failed to read knowledge base file:", error.message);
    return "No knowledge base entries available.";
  }
};

const buildSystemPrompt = (knowledgeContext) => `
You are a helpful customer support chatbot for Gaza Gate, a local marketplace e-commerce platform in Gaza.

RULES:
1. Answer ONLY using the knowledge base below. Do not invent information.
2. If the knowledge base does not contain enough information to answer the question, set canAnswer to false.
3. Keep answers clear, friendly, and concise (2-4 sentences max).
4. Support both Arabic and English questions. Reply in the same language the customer used.
5. Do not mention that you are an AI or that you are using a knowledge base.

KNOWLEDGE BASE:
${knowledgeContext}

Respond with valid JSON only in this exact shape:
{
  "canAnswer": true or false,
  "answer": "your answer here, or empty string if canAnswer is false"
}
`.trim();

const parseAiResponse = (text) => {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    const canAnswer = Boolean(parsed.canAnswer);
    const answer = typeof parsed.answer === "string" ? parsed.answer.trim() : "";

    if (!canAnswer || !answer || answer.includes(CANNOT_ANSWER_MARKER)) {
      return { canAnswer: false, answer: null };
    }

    return { canAnswer: true, answer };
  } catch {
    if (!cleaned || cleaned.includes(CANNOT_ANSWER_MARKER)) {
      return { canAnswer: false, answer: null };
    }
    return { canAnswer: true, answer: cleaned };
  }
};

const askAi = async (customerQuestion) => {
  const client = getClient();
  if (!client) {
    return { canAnswer: false, answer: null, failed: true, source: "ai_unavailable" };
  }

  const { model } = getConfig();
  const knowledgeContext = await buildKnowledgeContext();

  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.2,
      max_tokens: 512,
      messages: [
        { role: "system", content: buildSystemPrompt(knowledgeContext) },
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

const isAiEnabled = () => Boolean(process.env.AI_API_KEY);

module.exports = {
  askAi,
  isAiEnabled,
  CANNOT_ANSWER_MARKER,
};
