const { fn, col } = require("sequelize");
const Order = require("../models/order.model");
const OrderItem = require("../models/orderItem.model");
const Product = require("../models/product.model");
const ProductImage = require("../models/productImage.model");
const User = require("../models/user.model");
const Customer = require("../models/customer.model");
const Seller = require("../models/seller.model");
const AppError = require("../utils/AppError.util");
const ORDER_STATUSES = require("../constants/orderStatuses.constant");
const {
  STATUS_TRANSITIONS,
  STATUS_TIMESTAMP_FIELD,
  STATUS_LABELS,
} = require("../constants/orderStatusTransitions.constants");
const PAGINATION = require("../constants/pagination.constant");

const getSellerFromRequest = async (req) => {
  const userId = req.user?.id || req.user?.userId || null;

  if (!userId) return null;
  return Seller.findOne({
    where: { userId },
    attributes: ["id"],
  });
};

const getSellerOrderStats = async (sellerId) => {
  const rows = await Order.findAll({
    where: {
      sellerId,
      isDeleted: false,
    },
    attributes: ["status", [fn("COUNT", col("id")), "count"]],
    group: ["status"],
    raw: true,
  });

  const map = rows.reduce((acc, row) => {
    acc[row.status] = parseInt(row.count);
    return acc;
  }, {});

  return {
    total: Object.values(map).reduce((s, c) => s + c, 0),
    pendingReview: map[ORDER_STATUSES.PENDING_REVIEW] || 0,
    accepted: map[ORDER_STATUSES.ACCEPTED] || 0,
    inProduction: map[ORDER_STATUSES.IN_PRODUCTION] || 0,
    ready: map[ORDER_STATUSES.READY] || 0,
    completed: map[ORDER_STATUSES.COMPLETED] || 0,
    cancelled: map[ORDER_STATUSES.CANCELLED] || 0,
    rejected: map[ORDER_STATUSES.REJECTED] || 0,
  };
};

const getSellerOrders = async (req) => {
  const seller = await getSellerFromRequest(req);
  if (!seller) {
    throw AppError.fail("Seller not found.", 404);
  }
  const sellerId = seller.id;

  const page = Math.max(Number(req.query.page) || PAGINATION.DEFAULT_PAGE, 1);
  const limit = PAGINATION.DEFAULT_LIMIT;
  const offset = (page - 1) * limit;

  const where = {
    sellerId,
    isDeleted: false,
  };

  if (
    req.query.status &&
    Object.values(ORDER_STATUSES).includes(req.query.status)
  ) {
    where.status = req.query.status;
  }

  const [{ count, rows }, stats] = await Promise.all([
    Order.findAndCountAll({
      where,
      attributes: ["id", "orderNumber", "status", "totalPrice", "created_at"],
      include: [
        {
          model: Customer,
          as: "customer",
          attributes: ["id"],
          include: [
            {
              model: User,
              as: "user",
              attributes: ["firstName", "lastName"],
            },
          ],
        },
        {
          model: OrderItem,
          as: "items",
          attributes: ["id"],
        },
      ],
      order: [["created_at", "DESC"]],
      limit,
      offset,
      distinct: true,
    }),

    getSellerOrderStats(sellerId),
  ]);

  const formattedOrders = rows.map((order) => {
    const firstName = order.customer?.user?.firstName || "";
    const lastName = order.customer?.user?.lastName || "";

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: `${firstName} ${lastName}`.trim() || "عميل غير معروف",
      date: order.created_at,
      itemsCount: order.items ? order.items.length : 0,
      totalPrice: order.totalPrice,
      status: order.status,
    };
  });

  const totalPages = Math.ceil(count / limit);
  return {
    orders: formattedOrders,
    stats,
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

const getOrderDetails = async (req) => {
  const seller = await getSellerFromRequest(req);
  if (!seller) throw AppError.fail("Seller not found.", 404);
  const sellerId = seller.id;

  const order = await Order.findOne({
    where: {
      id: req.params.id,
      sellerId,
      isDeleted: false,
    },
    include: [
      {
        model: Customer,
        as: "customer",
        attributes: ["id"],
        include: [
          {
            model: User,
            as: "user",
            attributes: ["firstName", "lastName", "phone"],
          },
        ],
      },
      {
        model: OrderItem,
        as: "items",
      },
    ],
  });

  if (!order) throw AppError.fail("Order not found.", 404);

  const nextStatus = STATUS_TRANSITIONS[order.status] || null;
  const nextStatusLabel = nextStatus ? STATUS_LABELS[nextStatus] : null;

  return {
    order,
    workflow: {
      currentStatus: order.status,
      currentStatusLabel: STATUS_LABELS[order.status],
      nextStatus,
      nextStatusLabel,
      canUpdate: !!nextStatus,
      canReject: order.status === ORDER_STATUSES.PENDING_REVIEW,
    },
  };
};

const updateOrderStatus = async (req) => {
  const seller = await getSellerFromRequest(req);
  if (!seller) throw AppError.fail("Seller not found.", 404);
  const sellerId = seller.id;

  const order = await Order.findOne({
    where: { id: req.params.id, sellerId, isDeleted: false },
  });
  if (!order) throw AppError.fail("Order not found.", 404);

  const nextStatus = STATUS_TRANSITIONS[order.status];
  if (!nextStatus) {
    throw AppError.fail(
      `Cannot update the order because it is currently "${STATUS_LABELS[order.status]}".`,
      400,
    );
  }

  const timestampField = STATUS_TIMESTAMP_FIELD[nextStatus];

  await order.update({
    status: nextStatus,
    [timestampField]: new Date(),
  });

  await order.reload();

  return {
    orderId: order.id,
    updatedStatus: nextStatus,
    updatedStatusLabel: STATUS_LABELS[nextStatus],
    [timestampField]: order[timestampField],
  };
};

const rejectOrder = async (req) => {
  const seller = await getSellerFromRequest(req);
  if (!seller) throw AppError.fail("Seller not found.", 404);
  const sellerId = seller.id;

  const order = await Order.findOne({
    where: { id: req.params.id, sellerId, isDeleted: false },
  });
  if (!order) throw AppError.fail("Order not found.", 404);

  if (order.status !== ORDER_STATUSES.PENDING_REVIEW) {
    throw AppError.fail(
      'The order can only be rejected when its status is "Pending Review".',
      400,
    );
  }

  const { rejectionReason } = req.body || {};
  if (!rejectionReason?.trim()) {
    throw AppError.fail("Rejection reason is required.", 400);
  }

  await order.update({
    status: ORDER_STATUSES.REJECTED,
    rejectionReason: rejectionReason.trim(),
    rejectedAt: new Date(),
  });

  await order.reload();

  return {
    orderId: order.id,
    updatedStatus: ORDER_STATUSES.REJECTED,
    updatedStatusLabel: STATUS_LABELS[ORDER_STATUSES.REJECTED],
    rejectionReason: order.rejectionReason,
    rejectedAt: order.rejectedAt,
  };
};

module.exports = {
  getSellerOrders,
  getOrderDetails,
  updateOrderStatus,
  rejectOrder,
  getSellerOrderStats,
};
