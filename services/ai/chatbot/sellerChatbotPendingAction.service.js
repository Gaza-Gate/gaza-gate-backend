const {
  SELLER_CHATBOT_LIMITS,
} = require("../../../constants/chatbot/sellerChatbot.constant.js");

const pendingActions = new Map();

const getKey = (sellerUserId, sessionId) => `${sellerUserId}:${sessionId}`;

const purgeExpired = () => {
  const now = Date.now();
  for (const [key, action] of pendingActions.entries()) {
    if (action.expiresAt <= now) {
      pendingActions.delete(key);
    }
  }
};

const setPendingAction = (sellerUserId, sessionId, action) => {
  purgeExpired();
  const key = getKey(sellerUserId, sessionId);
  const pendingAction = {
    ...action,
    sellerUserId,
    sessionId,
    createdAt: new Date(),
    expiresAt: Date.now() + SELLER_CHATBOT_LIMITS.PENDING_ACTION_TTL_MS,
  };
  pendingActions.set(key, pendingAction);
  return pendingAction;
};

const getPendingAction = (sellerUserId, sessionId) => {
  purgeExpired();
  return pendingActions.get(getKey(sellerUserId, sessionId)) || null;
};

const consumePendingAction = (sellerUserId, sessionId) => {
  const action = getPendingAction(sellerUserId, sessionId);
  if (action) {
    pendingActions.delete(getKey(sellerUserId, sessionId));
  }
  return action;
};

const clearPendingAction = (sellerUserId, sessionId) => {
  pendingActions.delete(getKey(sellerUserId, sessionId));
};

module.exports = {
  setPendingAction,
  getPendingAction,
  consumePendingAction,
  clearPendingAction,
};
