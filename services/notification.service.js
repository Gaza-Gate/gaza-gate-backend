const { Op, fn, col } = require("sequelize");
const User = require("../models/user.model");
const Notification = require("../models/notification.model");
const Order = require("../models/order.model");
const UserNotification = require("../models/userNotification.model");
const PAGINATION = require("../constants/pagination.constant");
const NOTIFICATION_TYPES = require("../constants/notificationTypes.constant");
const AppError = require("../utils/AppError.util.js");
const { emitToUser } = require("../config/socket.config.js");

const createNotification = async ({
  recipientUserIds,
  type = NOTIFICATION_TYPES.GENERAL,
  title,
  content = null,
  actionUrl = null,
  relatedOrderId = null,
  senderId = null,
  order = null,
} = {}) => {
  const recipients = [
    ...new Set(
      (Array.isArray(recipientUserIds)
        ? recipientUserIds
        : [recipientUserIds]
      ).filter(Boolean),
    ),
  ];

  if (!recipients.length) {
    throw AppError.fail("At least one recipient is required.", 400);
  }
  if (!title || !String(title).trim()) {
    throw AppError.fail("Notification title is required.", 400);
  }

  const allowedTypes = new Set(Object.values(NOTIFICATION_TYPES));
  if (!allowedTypes.has(type)) {
    throw AppError.fail("Invalid notification type.", 400);
  }

  const notification = await Notification.create({
    senderId: senderId || null,
    type,
    title: String(title).trim(),
    content,
    actionUrl,
    relatedOrderId:
      type === NOTIFICATION_TYPES.ORDER ? relatedOrderId || null : null,
  });

  await UserNotification.bulkCreate(
    recipients.map((userId) => ({
      userId,
      notificationId: notification.id,
      isRead: false,
    })),
  );

  let senderPayload = null;
  if (senderId) {
    const sender = await User.findByPk(senderId, {
      attributes: ["id", "firstName", "lastName"],
    });
    if (sender) {
      senderPayload = {
        id: sender.id,
        name: `${sender.firstName} ${sender.lastName}`.trim(),
      };
    }
  }

  let orderPayload = order || null;
  if (!orderPayload && relatedOrderId) {
    const relatedOrder = await Order.findByPk(relatedOrderId, {
      attributes: ["id", "orderNumber", "status"],
    });
    if (relatedOrder) {
      orderPayload = {
        id: relatedOrder.id,
        orderNumber: relatedOrder.orderNumber,
        status: relatedOrder.status,
      };
    }
  }

  const notificationPayload = {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    content: notification.content,
    actionUrl: notification.actionUrl,
    isRead: false,
    sentAt: notification.sentAt,
    sender: senderPayload,
    order: orderPayload,
  };

  for (const userId of recipients) {
    const unRead = await UserNotification.count({
      where: { userId, isRead: false },
    });

    emitToUser(userId, "notification:new", {
      notification: notificationPayload,
      stats: { unRead },
    });
  }

  return notificationPayload;
};

const notifySafely = async (params) => {
  try {
    return await createNotification(params);
  } catch (error) {
    console.error("Failed to create notification:", error.message || error);
    return null;
  }
};

const getNotificationStats = async (userId) => {
  const rows = await Notification.findAll({
    attributes: ["type", [fn("COUNT", col("Notification.id")), "count"]],
    include: [
      {
        model: User,
        as: "recipients",
        where: { id: userId },
        attributes: [],
        through: { attributes: [] },
      },
    ],
    group: ["Notification.type"],
    raw: true,
  });

  const unReadCount = await UserNotification.count({
    where: { userId, isRead: false },
  });

  const map = rows.reduce((acc, row) => {
    acc[row.type] = parseInt(row.count);
    return acc;
  }, {});

  return {
    total: Object.values(map).reduce((s, c) => s + c, 0),
    order: map[NOTIFICATION_TYPES.ORDER] || 0,
    system: map[NOTIFICATION_TYPES.SYSTEM] || 0,
    product: map[NOTIFICATION_TYPES.PRODUCT] || 0,
    review: map[NOTIFICATION_TYPES.REVIEW] || 0,
    unRead: unReadCount,
  };
};

const getNotifications = async (userId, query = {}) => {
  if (!userId) throw AppError.fail("User authentication data is missing.", 401);

  const safeQuery = query || {};
  const page = Math.max(Number(safeQuery.page) || PAGINATION.DEFAULT_PAGE, 1);
  const limit = PAGINATION.DEFAULT_LIMIT;
  const offset = (page - 1) * limit;
  const rawType = safeQuery.type;
  const normalizedType =
    typeof rawType === "string" ? rawType.trim().toUpperCase() : "";
  const allowedTypes = new Set(Object.values(NOTIFICATION_TYPES));
  const type = allowedTypes.has(normalizedType) ? normalizedType : undefined;

  const notificationWhere = {};
  if (type) notificationWhere.type = type;

  const [{ count, rows }, stats] = await Promise.all([
    Notification.findAndCountAll({
      include: [
        {
          model: User,
          as: "recipients",
          where: { id: userId },
          attributes: [],
          through: {
            attributes: [],
          },
        },
        {
          model: User,
          as: "sender",
          attributes: ["id", "firstName", "lastName", "avatar"],
          required: false,
        },
        {
          model: Order,
          as: "order",
          attributes: ["id", "orderNumber", "status"],
          required: false,
        },
      ],
      where: notificationWhere,

      order: [["sentAt", "DESC"]],
      limit,
      offset,
      distinct: true,
    }),
    getNotificationStats(userId),
  ]);

  const totalPages = Math.ceil(count / limit);

  const notifications = await Promise.all(
    rows.map(async (n) => {
      const userNotifications = await UserNotification.findOne({
        where: {
          userId,
          notificationId: n.id,
        },
        attributes: ["notificationId", "isRead"],
      });
      return {
        id: n.id,
        type: n.type,
        title: n.title,
        content: n.content,
        actionUrl: n.actionUrl,
        isRead: userNotifications.isRead,
        sentAt: n.sentAt,
        sender: n.sender
          ? {
              id: n.sender.id,
              name: `${n.sender.firstName} ${n.sender.lastName}`.trim(),
            }
          : null,
        order: n.order
          ? {
              id: n.order.id,
              orderNumber: n.order.orderNumber,
              status: n.order.status,
            }
          : null,
      };
    }),
  );
  return {
    notifications,
    stats,
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      totalItems: count,
      pageSize: limit,
      hasNextPage: parseInt(page) < totalPages,
      hasPreviousPage: parseInt(page) > 1,
    },
  };
};

const markAllAsRead = async (userId) => {
  const [readedCount] = await UserNotification.update(
    { isRead: true },
    { where: { userId, isRead: false } },
  );

  return readedCount;
};

const markAsRead = async (userId, notificationId) => {
  const userNotification = await UserNotification.findOne({
    where: { userId, notificationId },
  });

  if (!userNotification) throw AppError.fail("Notification not found", 404);

  if (userNotification.isRead) return { alreadyRead: true };

  userNotification.isRead = true;
  await userNotification.save();

  return userNotification;
};

const deleteAllNotifications = async (userId) => {
  const deletedCount = await UserNotification.destroy({
    where: { userId },
  });

  return deletedCount;
};

const deleteNotification = async (userId, notificationId) => {
  const deletedCount = await UserNotification.destroy({
    where: { userId, notificationId },
  });

  if (!deletedCount) {
    throw AppError.fail("Notification not found.", 404);
  }

  return { notificationId, deleted: true };
};

module.exports = {
  createNotification,
  notifySafely,
  getNotifications,
  markAllAsRead,
  markAsRead,
  deleteAllNotifications,
  deleteNotification,
};
