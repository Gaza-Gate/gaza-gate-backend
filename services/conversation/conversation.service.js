const { Op } = require("sequelize");
const { sequelize } = require("../../config/db.config.js");
const Conversation = require("../../models/conversation.model.js");
const Message = require("../../models/message.model.js");
const User = require("../../models/user.model.js");
const Product = require("../../models/product.model.js");
const Seller = require("../../models/seller.model.js");
const Customer = require("../../models/customer.model.js");
const Order = require("../../models/order.model.js");
const OrderItem = require("../../models/orderItem.model.js");
const PAGINATION = require("../../constants/shared/pagination.constant.js");
const USER_ROLES = require("../../constants/user/userRoles.constant.js");
const NOTIFICATION_TYPES = require("../../constants/notification/notificationTypes.constant.js");
const AppError = require("../../utils/http/AppError.util.js");
const { isUserInConversationRoom } = require("../../socket/utils/room.util.js");

const getSocketUtils = () => require("../../config/socket.config.js");
const getNotificationService = () =>
  require("../notification/notification.service.js");

const MESSAGE_MAX_LENGTH = 5000;

const MESSAGE_ATTRIBUTES = [
  "id",
  "conversationId",
  "senderId",
  "content",
  "messageType",
  "productId",
  ["created_at", "createdAt"],
  ["updated_at", "updatedAt"],
];

const CONVERSATION_ATTRIBUTES = [
  "id",
  "sellerId",
  "customerId",
  "sourceType",
  "sourceId",
  "activeProductId",
  "lastMessageAt",
  "lastMessageId",
  "customerLastReadAt",
  "sellerLastReadAt",
  ["created_at", "createdAt"],
];

const USER_PARTY_ATTRIBUTES = ["id", "firstName", "lastName", "avatar"];

const normalizeUserId = (id) =>
  String(id || "")
    .trim()
    .toLowerCase();

const isConversationCustomer = (conversation, userId) =>
  normalizeUserId(conversation.customerId) === normalizeUserId(userId);

const assertParticipant = (conversation, userId) => {
  const normalizedUserId = normalizeUserId(userId);
  if (
    normalizeUserId(conversation.sellerId) !== normalizedUserId &&
    normalizeUserId(conversation.customerId) !== normalizedUserId
  ) {
    throw AppError.fail("Access denied.", 403);
  }
};

const getOtherPartyUserId = (conversation, userId) =>
  isConversationCustomer(conversation, userId)
    ? conversation.sellerId
    : conversation.customerId;

const resolveLastReadColumn = (conversation, userId) =>
  isConversationCustomer(conversation, userId)
    ? "customerLastReadAt"
    : "sellerLastReadAt";

const getLastReadAt = (conversation, userId) =>
  isConversationCustomer(conversation, userId)
    ? conversation.customerLastReadAt
    : conversation.sellerLastReadAt;

const loadConversationOrFail = async (conversationId) => {
  const conversation = await Conversation.findByPk(conversationId, {
    attributes: CONVERSATION_ATTRIBUTES,
  });
  if (!conversation) {
    throw AppError.fail("Conversation not found.", 404);
  }
  return conversation;
};

const buildOtherParty = (user, storeName = null) => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  avatar: user.avatar,
  storeName,
});

const buildPagination = (page, limit, total) => {
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  return {
    currentPage: page,
    totalPages,
    totalItems: total,
    pageSize: limit,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
};

const resolveStartContext = async (userId, data) => {
  const { sellerId, productId, orderId } = data || {};

  if (!sellerId && !productId && !orderId) {
    throw AppError.fail(
      "At least one of sellerId, productId, or orderId is required.",
      400,
    );
  }

  const customer = await Customer.findOne({
    where: { userId },
    attributes: ["id"],
  });
  if (!customer) {
    throw AppError.fail("Customer not found.", 404);
  }

  let sellerUserId;
  let sourceType = "direct";
  let sourceId = null;
  let activeProductId = null;

  if (productId) {
    const product = await Product.findByPk(productId, {
      attributes: ["id", "sellerId"],
    });
    if (!product) {
      throw AppError.fail("Product not found.", 404);
    }

    const seller = await Seller.findByPk(product.sellerId, {
      attributes: ["id", "userId"],
    });
    if (!seller) {
      throw AppError.fail("Seller not found.", 404);
    }

    sellerUserId = seller.userId;
    sourceType = "product";
    sourceId = productId;
    activeProductId = productId;
  } else if (orderId) {
    const order = await Order.findByPk(orderId, {
      attributes: ["id", "customerId", "sellerId"],
    });
    if (!order) {
      throw AppError.fail("Order not found.", 404);
    }
    if (order.customerId !== customer.id) {
      throw AppError.fail("Access denied.", 403);
    }

    const seller = await Seller.findByPk(order.sellerId, {
      attributes: ["id", "userId"],
    });
    if (!seller) {
      throw AppError.fail("Seller not found.", 404);
    }

    sellerUserId = seller.userId;
    sourceType = "order";
    sourceId = orderId;

    const firstItem = await OrderItem.findOne({
      where: { orderId },
      attributes: ["productId"],
      order: [["created_at", "ASC"]],
    });
    activeProductId = firstItem?.productId || null;
  } else {
    const seller = await Seller.findByPk(sellerId, {
      attributes: ["id", "userId"],
    });
    if (!seller) {
      throw AppError.fail("Seller not found.", 404);
    }

    sellerUserId = seller.userId;
    sourceType = "seller";
    sourceId = sellerId;
    activeProductId = null;
  }

  if (sellerUserId === userId) {
    throw AppError.fail("Cannot start a conversation with yourself.", 400);
  }

  return { sellerUserId, sourceType, sourceId, activeProductId };
};

const getUnreadCounts = async (conversations, userId) => {
  if (!conversations.length) return {};

  const counts = await Promise.all(
    conversations.map(async (conversation) => {
      const lastReadAt = getLastReadAt(conversation, userId);
      const where = {
        conversationId: conversation.id,
        senderId: { [Op.ne]: userId },
      };
      if (lastReadAt) {
        where[Op.and] = [
          sequelize.where(sequelize.col("created_at"), Op.gt, lastReadAt),
        ];
      }
      const unreadCount = await Message.count({ where });
      return { conversationId: conversation.id, unreadCount };
    }),
  );

  return counts.reduce((acc, row) => {
    acc[row.conversationId] = row.unreadCount;
    return acc;
  }, {});
};

const mapConversationListItem = (
  conversation,
  userId,
  unreadCount,
  storeNameByUserId,
) => {
  const isCustomer = isConversationCustomer(conversation, userId);
  const otherUser = isCustomer ? conversation.seller : conversation.customer;

  return {
    id: conversation.id,
    sourceType: conversation.sourceType,
    sourceId: conversation.sourceId,
    lastMessageAt: conversation.lastMessageAt,
    unreadCount,
    otherParty: buildOtherParty(
      otherUser,
      isCustomer ? storeNameByUserId[conversation.sellerId] || null : null,
    ),
    lastMessage: conversation.lastMessage
      ? {
          id: conversation.lastMessage.id,
          content: conversation.lastMessage.content,
          senderId: conversation.lastMessage.senderId,
          createdAt: conversation.lastMessage.createdAt,
        }
      : null,
    activeProduct: conversation.activeProduct
      ? {
          id: conversation.activeProduct.id,
          name: conversation.activeProduct.name,
        }
      : null,
  };
};

const listConversations = async (userId, role, query = {}) => {
  const page = Math.max(Number(query.page) || PAGINATION.DEFAULT_PAGE, 1);
  const limit = PAGINATION.DEFAULT_LIMIT;
  const offset = (page - 1) * limit;

  let where;
  if (role === USER_ROLES.CUSTOMER) {
    where = { customerId: userId };
  } else if (role === USER_ROLES.SELLER) {
    where = { sellerId: userId };
  } else {
    throw AppError.fail("Access denied.", 403);
  }

  const { count, rows } = await Conversation.findAndCountAll({
    where,
    attributes: CONVERSATION_ATTRIBUTES,
    include: [
      {
        model: Message,
        as: "lastMessage",
        attributes: ["id", "content", "senderId", ["created_at", "createdAt"]],
        required: false,
      },
      {
        model: User,
        as: "seller",
        attributes: USER_PARTY_ATTRIBUTES,
      },
      {
        model: User,
        as: "customer",
        attributes: USER_PARTY_ATTRIBUTES,
      },
      {
        model: Product,
        as: "activeProduct",
        attributes: ["id", "name"],
        required: false,
      },
    ],
    order: [
      [sequelize.fn("ISNULL", sequelize.col("last_message_at")), "ASC"],
      ["lastMessageAt", "DESC"],
    ],
    limit,
    offset,
    distinct: true,
  });

  const sellerUserIds = rows
    .filter((conversation) => isConversationCustomer(conversation, userId))
    .map((conversation) => conversation.sellerId);

  const sellers = sellerUserIds.length
    ? await Seller.findAll({
        where: { userId: sellerUserIds },
        attributes: ["userId", "storeName"],
      })
    : [];

  const storeNameByUserId = sellers.reduce((acc, seller) => {
    acc[seller.userId] = seller.storeName;
    return acc;
  }, {});

  const unreadByConversationId = await getUnreadCounts(rows, userId);

  const conversations = rows.map((conversation) =>
    mapConversationListItem(
      conversation,
      userId,
      unreadByConversationId[conversation.id] || 0,
      storeNameByUserId,
    ),
  );

  return {
    conversations,
    pagination: buildPagination(page, limit, count),
  };
};

const startConversation = async (userId, role, data) => {
  if (role !== USER_ROLES.CUSTOMER) {
    throw AppError.fail("Only customers can start conversations.", 403);
  }

  const { sellerUserId, sourceType, sourceId, activeProductId } =
    await resolveStartContext(userId, data);

  const defaults = {
    sellerId: sellerUserId,
    customerId: userId,
    sourceType,
    sourceId,
    activeProductId,
  };

  let conversation;
  let created = false;

  try {
    [conversation, created] = await Conversation.findOrCreate({
      where: { sellerId: sellerUserId, customerId: userId },
      defaults,
      attributes: CONVERSATION_ATTRIBUTES,
    });
  } catch (error) {
    if (error.name !== "SequelizeUniqueConstraintError") {
      throw error;
    }

    conversation = await Conversation.findOne({
      where: { sellerId: sellerUserId, customerId: userId },
      attributes: CONVERSATION_ATTRIBUTES,
    });
    created = false;
  }

  if (!created && (data?.productId || data?.orderId || data?.sellerId)) {
    await conversation.update({
      sourceType,
      sourceId,
      activeProductId,
    });
    await conversation.reload({ attributes: CONVERSATION_ATTRIBUTES });
  }

  return { conversation, created };
};

const getOtherPartyForConversation = async (conversation, userId) => {
  const isCustomer = isConversationCustomer(conversation, userId);
  const otherUserId = getOtherPartyUserId(conversation, userId);

  const otherUser = await User.findByPk(otherUserId, {
    attributes: USER_PARTY_ATTRIBUTES,
  });

  let storeName = null;
  if (isCustomer) {
    const seller = await Seller.findOne({
      where: { userId: otherUserId },
      attributes: ["storeName"],
    });
    storeName = seller?.storeName || null;
  }

  return buildOtherParty(otherUser, storeName);
};

const getConversation = async (userId, conversationId, query = {}) => {
  const conversation = await Conversation.findByPk(conversationId, {
    attributes: CONVERSATION_ATTRIBUTES,
    include: [
      {
        model: Product,
        as: "activeProduct",
        attributes: ["id", "name"],
        required: false,
      },
    ],
  });

  if (!conversation) {
    throw AppError.fail("Conversation not found.", 404);
  }

  assertParticipant(conversation, userId);

  const page = Math.max(Number(query.page) || PAGINATION.DEFAULT_PAGE, 1);
  const limit = PAGINATION.DEFAULT_LIMIT;

  const total = await Message.count({ where: { conversationId } });
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const offset = Math.max(total - safePage * limit, 0);

  const messages = await Message.findAll({
    where: { conversationId },
    attributes: [
      "id",
      "senderId",
      "content",
      "messageType",
      "productId",
      ["created_at", "createdAt"],
    ],
    include: [
      {
        model: User,
        as: "sender",
        attributes: USER_PARTY_ATTRIBUTES,
      },
    ],
    order: [["created_at", "ASC"]],
    offset,
    limit,
  });

  const otherParty = await getOtherPartyForConversation(conversation, userId);

  await markAsRead(userId, conversationId);

  return {
    conversation: {
      id: conversation.id,
      sourceType: conversation.sourceType,
      sourceId: conversation.sourceId,
      otherParty,
      activeProduct: conversation.activeProduct
        ? {
            id: conversation.activeProduct.id,
            name: conversation.activeProduct.name,
          }
        : null,
    },
    messages,
    pagination: {
      currentPage: safePage,
      totalPages,
      totalItems: total,
      pageSize: limit,
      hasNextPage: safePage < totalPages,
      hasPreviousPage: safePage > 1,
    },
  };
};

const validateMessageContent = (content) => {
  const trimmed = String(content ?? "").trim();
  if (!trimmed) {
    throw AppError.fail("Message content cannot be empty.", 400);
  }
  if (trimmed.length > MESSAGE_MAX_LENGTH) {
    throw AppError.fail(
      `Message content cannot exceed ${MESSAGE_MAX_LENGTH} characters.`,
      400,
    );
  }
  return trimmed;
};

const buildMessagePayload = (message) => ({
  id: message.id,
  conversationId: message.conversationId,
  senderId: message.senderId,
  content: message.content,
  messageType: message.messageType,
  productId: message.productId,
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
});

const buildLastMessagePreview = (message) =>
  message
    ? {
        id: message.id,
        content: message.content,
        senderId: message.senderId,
        createdAt: message.createdAt,
      }
    : null;

const loadMessageOrFail = async (messageId, conversationId) => {
  const message = await Message.findOne({
    where: { id: messageId, conversationId },
    attributes: MESSAGE_ATTRIBUTES,
  });
  if (!message) {
    throw AppError.fail("Message not found.", 404);
  }
  return message;
};

const assertMessageSender = (message, userId) => {
  if (normalizeUserId(message.senderId) !== normalizeUserId(userId)) {
    throw AppError.fail("You can only modify your own messages.", 403);
  }
};

const syncConversationLastMessage = async (
  conversationId,
  transaction = null,
) => {
  const findOptions = {
    where: { conversationId },
    attributes: ["id", "senderId", "content", ["created_at", "createdAt"]],
    order: [["created_at", "DESC"]],
  };
  if (transaction) {
    findOptions.transaction = transaction;
  }

  const latestMessage = await Message.findOne(findOptions);

  const updateOptions = { where: { id: conversationId } };
  if (transaction) {
    updateOptions.transaction = transaction;
  }

  await Conversation.update(
    {
      lastMessageId: latestMessage?.id || null,
      lastMessageAt: latestMessage?.createdAt || null,
    },
    updateOptions,
  );

  return latestMessage;
};

const emitConversationPreviewUpdate = (
  conversationId,
  recipientId,
  lastMessage,
  lastMessageAt,
) => {
  try {
    const { getIO, emitToUser } = getSocketUtils();
    const io = getIO();
    const payload = {
      conversationId,
      lastMessage,
      lastMessageAt,
    };
    io.to(`conversation:${conversationId}`).emit(
      "conversation:updated",
      payload,
    );
    emitToUser(recipientId, "conversation:updated", payload);
  } catch {
    // Socket may not be initialized in some environments.
  }
};

const sendMessage = async (userId, conversationId, { content, productId }) => {
  const conversation = await loadConversationOrFail(conversationId);
  assertParticipant(conversation, userId);

  const trimmedContent = validateMessageContent(content);

  if (productId) {
    const product = await Product.findByPk(productId, {
      attributes: ["id", "sellerId"],
    });
    if (!product) {
      throw AppError.fail("Product not found.", 404);
    }

    const seller = await Seller.findOne({
      where: { userId: conversation.sellerId },
      attributes: ["id"],
    });
    if (!seller || product.sellerId !== seller.id) {
      throw AppError.fail("Product does not belong to this conversation.", 400);
    }
  }

  const message = await sequelize.transaction(async (transaction) => {
    const createdMessage = await Message.create(
      {
        conversationId,
        senderId: userId,
        content: trimmedContent,
        messageType: "text",
        productId: productId || null,
      },
      { transaction },
    );

    await conversation.update(
      {
        lastMessageId: createdMessage.id,
        lastMessageAt: createdMessage.createdAt,
      },
      { transaction },
    );

    return createdMessage;
  });

  const messagePayload = {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    content: message.content,
    messageType: message.messageType,
    productId: message.productId,
    createdAt: message.createdAt,
  };

  const recipientId = getOtherPartyUserId(conversation, userId);
  let io = null;

  try {
    const { getIO, emitToUser } = getSocketUtils();
    io = getIO();

    io.to(`conversation:${conversationId}`).emit("new_message", {
      message: messagePayload,
    });

    emitToUser(recipientId, "conversation:updated", {
      conversationId,
      lastMessage: {
        id: messagePayload.id,
        content: messagePayload.content,
        senderId: messagePayload.senderId,
        createdAt: messagePayload.createdAt,
      },
      lastMessageAt: messagePayload.createdAt,
    });
  } catch {
    // Socket may not be initialized in some environments (HTTP-only / tests).
  }

  const recipientInConversationRoom = io
    ? isUserInConversationRoom(io, conversationId, recipientId)
    : false;

  if (!recipientInConversationRoom) {
    try {
      const { emitToUser } = getSocketUtils();
      // Fallback for clients that are connected but not joined to the conversation room.
      emitToUser(recipientId, "new_message", {
        message: messagePayload,
      });
    } catch {
      // Socket may not be initialized in some environments.
    }

    const preview =
      trimmedContent.length > 100
        ? `${trimmedContent.slice(0, 100)}...`
        : trimmedContent;

    await getNotificationService().notifySafely({
      recipientUserIds: [recipientId],
      senderId: userId,
      type: NOTIFICATION_TYPES.GENERAL,
      title: "New message",
      content: preview,
      actionUrl: `/conversations/${conversationId}`,
    });
  } else {
    await markAsRead(recipientId, conversationId);
  }

  return messagePayload;
};

const updateMessage = async (
  userId,
  conversationId,
  messageId,
  { content },
) => {
  const conversation = await loadConversationOrFail(conversationId);
  assertParticipant(conversation, userId);

  const message = await loadMessageOrFail(messageId, conversationId);
  assertMessageSender(message, userId);

  const trimmedContent = validateMessageContent(content);
  await message.update({ content: trimmedContent });
  await message.reload({ attributes: MESSAGE_ATTRIBUTES });

  const messagePayload = buildMessagePayload(message);
  const recipientId = getOtherPartyUserId(conversation, userId);

  try {
    const { getIO } = getSocketUtils();
    getIO()
      .to(`conversation:${conversationId}`)
      .emit("message_updated", { message: messagePayload });
  } catch {
    // Socket may not be initialized in some environments.
  }

  if (
    normalizeUserId(conversation.lastMessageId) === normalizeUserId(messageId)
  ) {
    emitConversationPreviewUpdate(
      conversationId,
      recipientId,
      buildLastMessagePreview(messagePayload),
      messagePayload.createdAt,
    );
  }

  return messagePayload;
};

const deleteMessage = async (userId, conversationId, messageId) => {
  const conversation = await loadConversationOrFail(conversationId);
  assertParticipant(conversation, userId);

  const message = await loadMessageOrFail(messageId, conversationId);
  assertMessageSender(message, userId);

  const wasLastMessage =
    normalizeUserId(conversation.lastMessageId) === normalizeUserId(messageId);

  const latestMessage = await sequelize.transaction(async (transaction) => {
    await message.destroy({ transaction });
    return wasLastMessage
      ? syncConversationLastMessage(conversationId, transaction)
      : null;
  });

  const recipientId = getOtherPartyUserId(conversation, userId);

  try {
    const { getIO } = getSocketUtils();
    getIO()
      .to(`conversation:${conversationId}`)
      .emit("message_deleted", { conversationId, messageId });
  } catch {
    // Socket may not be initialized in some environments.
  }

  if (wasLastMessage) {
    const lastMessagePreview = buildLastMessagePreview(latestMessage);
    emitConversationPreviewUpdate(
      conversationId,
      recipientId,
      lastMessagePreview,
      latestMessage?.createdAt || null,
    );
  }

  return {
    conversationId,
    messageId,
    ...(wasLastMessage
      ? {
          lastMessage: buildLastMessagePreview(latestMessage),
          lastMessageAt: latestMessage?.createdAt || null,
        }
      : {}),
  };
};

const markAsRead = async (userId, conversationId) => {
  const conversation = await loadConversationOrFail(conversationId);
  assertParticipant(conversation, userId);

  const column = resolveLastReadColumn(conversation, userId);
  const lastReadAt = new Date();

  await Conversation.update(
    { [column]: lastReadAt },
    { where: { id: conversationId } },
  );

  try {
    const { getIO } = getSocketUtils();
    getIO().to(`conversation:${conversationId}`).emit("conversation_read", {
      conversationId,
      userId,
      lastReadAt,
    });
  } catch {
    // Socket may not be initialized in some environments.
  }

  return { conversationId, lastReadAt };
};

module.exports = {
  assertParticipant,
  getOtherPartyUserId,
  resolveLastReadColumn,
  listConversations,
  startConversation,
  getConversation,
  sendMessage,
  updateMessage,
  deleteMessage,
  markAsRead,
  loadConversationOrFail,
};
