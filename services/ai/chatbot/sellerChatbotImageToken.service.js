const crypto = require("crypto");
const {
  SELLER_CHATBOT_LIMITS,
} = require("../../../constants/chatbot/sellerChatbot.constant.js");
const AppError = require("../../../utils/http/AppError.util.js");

const tokenStore = new Map();
const sessionImageStore = new Map();

const purgeExpired = () => {
  const now = Date.now();
  for (const [token, entry] of tokenStore.entries()) {
    if (entry.expiresAt <= now) {
      tokenStore.delete(token);
    }
  }
  for (const [sessionId, entry] of sessionImageStore.entries()) {
    if (entry.expiresAt <= now) {
      sessionImageStore.delete(sessionId);
    }
  }
};

const createImageToken = (sellerUserId, imageData) => {
  purgeExpired();
  const token = crypto.randomUUID();
  tokenStore.set(token, {
    sellerUserId,
    buffer: imageData.buffer,
    mimeType: imageData.mimeType,
    imageUrl: imageData.imageUrl,
    expiresAt: Date.now() + SELLER_CHATBOT_LIMITS.IMAGE_TOKEN_TTL_MS,
  });
  return token;
};

const setSessionImage = (sellerUserId, sessionId, imageData) => {
  const token = createImageToken(sellerUserId, imageData);
  sessionImageStore.set(sessionId, {
    token,
    sellerUserId,
    imageUrl: imageData.imageUrl,
    expiresAt: Date.now() + SELLER_CHATBOT_LIMITS.IMAGE_TOKEN_TTL_MS,
  });
  return token;
};

const getSessionImage = (sellerUserId, sessionId) => {
  purgeExpired();
  const entry = sessionImageStore.get(sessionId);
  if (!entry) return null;
  if (entry.sellerUserId !== sellerUserId) return null;
  if (entry.expiresAt <= Date.now()) {
    sessionImageStore.delete(sessionId);
    return null;
  }
  return { token: entry.token, imageUrl: entry.imageUrl };
};

const resolveImageToken = (sellerUserId, token) => {
  purgeExpired();
  const entry = tokenStore.get(token);
  if (!entry) {
    throw AppError.fail("Image token is invalid or expired.", 400);
  }
  if (entry.sellerUserId !== sellerUserId) {
    throw AppError.fail("Image token does not belong to this seller.", 403);
  }
  if (entry.expiresAt <= Date.now()) {
    tokenStore.delete(token);
    throw AppError.fail("Image token has expired.", 400);
  }
  return entry;
};

const consumeImageToken = (sellerUserId, token) => {
  const entry = resolveImageToken(sellerUserId, token);
  tokenStore.delete(token);
  for (const [sessionId, sessionEntry] of sessionImageStore.entries()) {
    if (sessionEntry.token === token) {
      sessionImageStore.delete(sessionId);
      break;
    }
  }
  return entry;
};

const consumeSessionImage = (sellerUserId, sessionId) => {
  const sessionEntry = getSessionImage(sellerUserId, sessionId);
  if (!sessionEntry) {
    throw AppError.fail(
      "No product image in this chat. Upload an image first.",
      400,
    );
  }
  sessionImageStore.delete(sessionId);
  return consumeImageToken(sellerUserId, sessionEntry.token);
};

module.exports = {
  createImageToken,
  setSessionImage,
  getSessionImage,
  resolveImageToken,
  consumeImageToken,
  consumeSessionImage,
};
