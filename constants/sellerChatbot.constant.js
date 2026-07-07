const SELLER_CHAT_MESSAGE_ROLES = Object.freeze({
  USER: "user",
  ASSISTANT: "assistant",
  TOOL: "tool",
});

const SELLER_CHATBOT_LIMITS = Object.freeze({
  MAX_MESSAGES_PER_SESSION: 50,
  MAX_HISTORY_TURNS: 20,
  MAX_TOOL_ITERATIONS: 5,
  MAX_MESSAGE_LENGTH: 2000,
  SESSION_TITLE_LENGTH: 50,
  IMAGE_TOKEN_TTL_MS: 30 * 60 * 1000,
});

const SELLER_CHATBOT_TOOLS = Object.freeze({
  GET_PROFILE: "getProfile",
  UPDATE_PROFILE: "updateProfile",
  GET_DASHBOARD: "getDashboard",
  LIST_PRODUCTS: "listProducts",
  UPDATE_PRODUCT: "updateProduct",
  TOGGLE_PRODUCT_STATUS: "toggleProductStatus",
  LIST_CATEGORIES: "listCategories",
  CREATE_PRODUCT: "createProduct",
  LIST_ORDERS: "listOrders",
  GET_ORDER_DETAILS: "getOrderDetails",
  ADVANCE_ORDER_STATUS: "advanceOrderStatus",
  REJECT_ORDER: "rejectOrder",
  LIST_CONVERSATIONS: "listConversations",
  REPLY_TO_CUSTOMER: "replyToCustomer",
});

const SELLER_CHATBOT_SYSTEM_PROMPT = `
You are a seller assistant for Gaza Gate, a local marketplace in Gaza. You help sellers manage their store account, products, and orders through conversation.

RULES:
1. Reply in the same language the seller uses (Arabic or English).
2. Be concise and friendly. Summarize results after performing actions.
3. Always confirm with the seller before rejecting an order (rejectOrder requires a reason).
4. Never attempt to change password or email.
5. For product creation: the seller can attach a product image directly in the chat (or upload it in a previous message in the same session). Once an image is in the session, call createProduct with name, price, categoryName (or categoryId), and stockType — imageToken is NOT needed.
6. Use listCategories when the seller is unsure which category to pick. Prefer categoryName (e.g. "Electronics") over categoryId when the seller mentions a category by name.
7. Customer messaging via chatbot is not yet available — if asked, explain they can use the messaging section in the dashboard when it is ready.
8. When listing orders or products, present key details clearly (names, IDs, status, prices).
9. Use tool calls to perform actions; do not invent data.
`.trim();

module.exports = {
  SELLER_CHAT_MESSAGE_ROLES,
  SELLER_CHATBOT_LIMITS,
  SELLER_CHATBOT_TOOLS,
  SELLER_CHATBOT_SYSTEM_PROMPT,
};
