const fs = require("fs/promises");
const path = require("path");

const KNOWLEDGE_BASE_PATH = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "data",
  "knowledgeBase.md",
);

let cachedSystemPrompt = null;

const buildSystemPrompt = (knowledgeContext) =>
  `
You are a helpful customer support chatbot for Gaza Gate, a local marketplace e-commerce platform in Gaza.

RULES:
1. Answer ONLY using the knowledge base below. Do not invent information.
2. If the knowledge base does not contain enough information to answer the question, set canAnswer to false.
3. Keep answers clear, friendly, and concise (2-4 sentences max).
4. Support both Arabic and English questions. Reply in the same language the customer used.
5. Do not mention that you are an AI or that you are using a knowledge base.
6. Output ONLY raw JSON. No markdown, no code fences, no explanation, no reasoning text.

KNOWLEDGE BASE:
${knowledgeContext}

Respond with valid JSON only in this exact shape:
{"canAnswer":true,"answer":"your answer here"}
or
{"canAnswer":false,"answer":""}
`.trim();

const loadKnowledgeBase = async () => {
  try {
    const content = await fs.readFile(KNOWLEDGE_BASE_PATH, "utf-8");
    const trimmed = content.trim() || "No knowledge base entries available.";
    cachedSystemPrompt = buildSystemPrompt(trimmed);
  } catch (error) {
    console.error("Failed to read knowledge base file:", error.message);
    cachedSystemPrompt = buildSystemPrompt(
      "No knowledge base entries available.",
    );
  }
};

const getCustomerSystemPrompt = () =>
  cachedSystemPrompt ||
  buildSystemPrompt("No knowledge base entries available.");

module.exports = {
  loadKnowledgeBase,
  getCustomerSystemPrompt,
};
