const ChatbotRecord = require("../../../models/chatbotRecord.model.js");
const Seller = require("../../../models/seller.model.js");
const cloudinaryService = require("../../integrations/cloudinary.service.js");
const sellerAiAgent = require("../sellerAiAgent.service.js");
const imageTokenService = require("./sellerChatbotImageToken.service.js");
const {
  CHATBOT_RECORD_TYPES,
} = require("../../../constants/chatbot/chatbot.constant.js");
const {
  SELLER_CHAT_MESSAGE_ROLES,
  SELLER_CHATBOT_LIMITS,
} = require("../../../constants/chatbot/sellerChatbot.constant.js");
const PAGINATION = require("../../../constants/shared/pagination.constant.js");
const AppError = require("../../../utils/http/AppError.util.js");

const ensureSeller = async (userId) => {
  const seller = await Seller.findOne({
    where: { userId },
    attributes: ["id"],
  });
  if (!seller) throw AppError.fail("Seller not found.", 404);
  return seller;
};

const buildSessionTitle = (message) => {
  const trimmed = message.trim();
  if (trimmed.length <= SELLER_CHATBOT_LIMITS.SESSION_TITLE_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, SELLER_CHATBOT_LIMITS.SESSION_TITLE_LENGTH - 3)}...`;
};

const getSessionForSeller = async (sessionId, userId) => {
  const session = await ChatbotRecord.findOne({
    where: {
      id: sessionId,
      userId,
      recordType: CHATBOT_RECORD_TYPES.SELLER_SESSION,
    },
  });
  if (!session) throw AppError.fail("Chat session not found.", 404);
  return session;
};

const getSessionMessageCount = async (sessionId) =>
  ChatbotRecord.count({
    where: {
      sessionId,
      recordType: CHATBOT_RECORD_TYPES.SELLER_MESSAGE,
    },
  });

const touchSession = async (session) => {
  await session.update({ content: session.content });
};

const loadChatHistory = async (sessionId) => {
  const messages = await ChatbotRecord.findAll({
    where: {
      sessionId,
      recordType: CHATBOT_RECORD_TYPES.SELLER_MESSAGE,
      role: [
        SELLER_CHAT_MESSAGE_ROLES.USER,
        SELLER_CHAT_MESSAGE_ROLES.ASSISTANT,
      ],
    },
    attributes: ["role", "content"],
    order: [["created_at", "ASC"]],
    limit: SELLER_CHATBOT_LIMITS.MAX_HISTORY_TURNS * 2,
  });

  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
};

const chat = async (userId, message, sessionId, file) => {
  await ensureSeller(userId);
  const trimmedMessage = (message || "").trim();

  let session;
  let messageCount;

  if (sessionId) {
    [session, messageCount] = await Promise.all([
      getSessionForSeller(sessionId, userId),
      getSessionMessageCount(sessionId),
    ]);
  } else {
    session = await ChatbotRecord.create({
      userId,
      recordType: CHATBOT_RECORD_TYPES.SELLER_SESSION,
      content: buildSessionTitle(trimmedMessage || "Product image"),
    });
    messageCount = 0;
  }

  if (messageCount >= SELLER_CHATBOT_LIMITS.MAX_MESSAGES_PER_SESSION) {
    throw AppError.fail(
      "This chat session has reached the maximum number of messages.",
      400,
    );
  }

  const history = sessionId ? await loadChatHistory(session.id) : [];

  let productImageReady = false;
  let uploadedImageUrl = null;
  let uploadPromise = null;

  if (file) {
    const folder = `chatbot-products/${userId}`;
    imageTokenService.setSessionImage(userId, session.id, {
      buffer: file.buffer,
      mimeType: file.mimetype,
      imageUrl: null,
    });
    productImageReady = true;
    uploadPromise = cloudinaryService.uploadImage(file.buffer, folder);
  } else {
    const pending = imageTokenService.getSessionImage(userId, session.id);
    productImageReady = !!pending;
    uploadedImageUrl = pending?.imageUrl || null;
  }

  const displayMessage =
    trimmedMessage || (file ? "[Product image attached]" : "");

  await ChatbotRecord.create({
    userId,
    sessionId: session.id,
    recordType: CHATBOT_RECORD_TYPES.SELLER_MESSAGE,
    role: SELLER_CHAT_MESSAGE_ROLES.USER,
    content: displayMessage,
  });

  const agentContext = {
    sessionId: session.id,
    hasProductImage: productImageReady,
  };

  const agentPromise = sellerAiAgent.runAgent(
    userId,
    history,
    displayMessage,
    agentContext,
  );

  const [agentResult, uploaded] = await Promise.all([
    agentPromise,
    uploadPromise ?? Promise.resolve(null),
  ]);

  if (uploaded) {
    uploadedImageUrl = uploaded.url;
    imageTokenService.setSessionImage(userId, session.id, {
      buffer: file.buffer,
      mimeType: file.mimetype,
      imageUrl: uploaded.url,
    });
  }

  await ChatbotRecord.create({
    userId,
    sessionId: session.id,
    recordType: CHATBOT_RECORD_TYPES.SELLER_MESSAGE,
    role: SELLER_CHAT_MESSAGE_ROLES.ASSISTANT,
    content: agentResult.reply,
  });

  await touchSession(session);

  return {
    reply: agentResult.reply,
    sessionId: session.id,
    actions: agentResult.actions,
    productImageReady: !!imageTokenService.getSessionImage(userId, session.id),
    ...(uploadedImageUrl && { productImageUrl: uploadedImageUrl }),
  };
};

const uploadProductImage = async (userId, file, sessionId) => {
  await ensureSeller(userId);
  if (!file) throw AppError.fail("Product image is required.", 400);

  const folder = `chatbot-products/${userId}`;
  const uploaded = await cloudinaryService.uploadImage(file.buffer, folder);

  const imageData = {
    buffer: file.buffer,
    mimeType: file.mimetype,
    imageUrl: uploaded.url,
  };

  if (sessionId) {
    await getSessionForSeller(sessionId, userId);
    imageTokenService.setSessionImage(userId, sessionId, imageData);
    return {
      sessionId,
      imageUrl: uploaded.url,
      productImageReady: true,
      expiresInMinutes: SELLER_CHATBOT_LIMITS.IMAGE_TOKEN_TTL_MS / 60000,
    };
  }

  const imageToken = imageTokenService.createImageToken(userId, imageData);
  return {
    imageToken,
    imageUrl: uploaded.url,
    expiresInMinutes: SELLER_CHATBOT_LIMITS.IMAGE_TOKEN_TTL_MS / 60000,
  };
};

const getSessions = async (userId, query = {}) => {
  await ensureSeller(userId);

  const page = Math.max(Number(query.page) || PAGINATION.DEFAULT_PAGE, 1);
  const limit = PAGINATION.DEFAULT_LIMIT;
  const offset = (page - 1) * limit;

  const { count, rows } = await ChatbotRecord.findAndCountAll({
    where: {
      userId,
      recordType: CHATBOT_RECORD_TYPES.SELLER_SESSION,
    },
    attributes: [
      "id",
      "content",
      ["created_at", "createdAt"],
      ["updated_at", "updatedAt"],
    ],
    order: [["updated_at", "DESC"]],
    limit,
    offset,
  });

  const totalPages = Math.ceil(count / limit);

  return {
    sessions: rows.map((row) => ({
      id: row.id,
      title: row.content,
      createdAt: row.dataValues.createdAt,
      updatedAt: row.dataValues.updatedAt,
    })),
    pagination: {
      totalItems: count,
      totalPages,
      currentPage: page,
      pageSize: limit,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
};

const getSessionMessages = async (userId, sessionId) => {
  await getSessionForSeller(sessionId, userId);

  const messages = await ChatbotRecord.findAll({
    where: {
      sessionId,
      recordType: CHATBOT_RECORD_TYPES.SELLER_MESSAGE,
      role: [
        SELLER_CHAT_MESSAGE_ROLES.USER,
        SELLER_CHAT_MESSAGE_ROLES.ASSISTANT,
      ],
    },
    attributes: [
      "id",
      "role",
      "content",
      "toolName",
      ["created_at", "createdAt"],
    ],
    order: [["created_at", "ASC"]],
  });

  return {
    messages: messages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      toolName: msg.toolName,
      createdAt: msg.dataValues.createdAt,
    })),
  };
};

module.exports = {
  chat,
  uploadProductImage,
  getSessions,
  getSessionMessages,
};
