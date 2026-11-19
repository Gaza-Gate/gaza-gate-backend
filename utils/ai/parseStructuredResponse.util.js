const CANNOT_ANSWER_MARKER = "__CANNOT_ANSWER__";

const INVALID_ANSWER_PATTERNS = [
  /```/,
  /"canAnswer"/,
  /\*Refining/i,
  /^\s*[\{\[]/,
  /\n\s*\}/,
];

const isValidAnswer = (answer) => {
  if (!answer || answer.length < 2) return false;
  if (answer.includes(CANNOT_ANSWER_MARKER)) return false;
  return !INVALID_ANSWER_PATTERNS.some((pattern) => pattern.test(answer));
};

const extractJsonObject = (text) => {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
};

const parseStructuredPayload = (parsed) => {
  const canAnswer = parsed.canAnswer === true || parsed.canAnswer === "true";
  const answer = typeof parsed.answer === "string" ? parsed.answer.trim() : "";

  if (!canAnswer || !isValidAnswer(answer)) {
    return { canAnswer: false, answer: null };
  }

  return { canAnswer: true, answer };
};

const tryExtractAnswerField = (text) => {
  const match = text.match(/"answer"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (!match) return null;

  try {
    return JSON.parse(`"${match[1]}"`).trim();
  } catch {
    return match[1].trim();
  }
};

const tryExtractTruncatedAnswer = (text) => {
  const match = text.match(
    /"canAnswer"\s*:\s*true[\s\S]*?"answer"\s*:\s*"([\s\S]*)$/i,
  );
  if (!match) return null;

  let answer = match[1];
  if (answer.endsWith("\\")) answer = answer.slice(0, -1);
  answer = answer.replace(/\\"/g, '"').replace(/\\n/g, "\n").trim();

  return answer || null;
};

const parseAiResponse = (text) => {
  const cleaned = text
    .trim()
    .replace(/```(?:json)?/gi, "")
    .trim();

  if (!cleaned || cleaned.includes(CANNOT_ANSWER_MARKER)) {
    return { canAnswer: false, answer: null };
  }

  const candidates = [cleaned, extractJsonObject(cleaned)].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return parseStructuredPayload(JSON.parse(candidate));
    } catch {
      // try next candidate
    }
  }

  const extracted = tryExtractAnswerField(cleaned);
  if (isValidAnswer(extracted)) {
    return { canAnswer: true, answer: extracted };
  }

  const truncated = tryExtractTruncatedAnswer(cleaned);
  if (isValidAnswer(truncated)) {
    return { canAnswer: true, answer: truncated };
  }

  return { canAnswer: false, answer: null };
};

module.exports = {
  CANNOT_ANSWER_MARKER,
  parseAiResponse,
};
