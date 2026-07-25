const { Op, fn, col } = require("sequelize");
const Order = require("../../models/order.model.js");
const OrderItem = require("../../models/orderItem.model.js");
const Product = require("../../models/product.model.js");
const ProductImage = require("../../models/productImage.model.js");
const User = require("../../models/user.model.js");
const Customer = require("../../models/customer.model.js");
const Seller = require("../../models/seller.model.js");
const AppError = require("../../utils/http/AppError.util.js");
const ORDER_STATUSES = require("../../constants/order/orderStatuses.constant.js");
const {
  STATUS_TRANSITIONS,
  STATUS_TIMESTAMP_FIELD,
  STATUS_LABELS,
} = require("../../constants/order/orderStatusTransitions.constant.js");
const PAGINATION = require("../../constants/shared/pagination.constant.js");
const NOTIFICATION_TYPES = require("../../constants/notification/notificationTypes.constant.js");
const notificationService = require("../notification/notification.service.js");
const USER_ROLES = require("../../constants/user/userRoles.constant.js");
const { mapCustomerSummary } = require("../../utils/navigation/customerProfileLink.util.js");
const {
  getCustomersOrderTrustStats,
  getCustomerOrderTrustStats,
} = require("../../utils/navigation/customerTrustStats.util.js");

const getSellerFromRequest = async (req) => {
  const userId = req.user?.id || req.user?.userId || null;

  if (!userId) return null;

  if (req.user?.role !== USER_ROLES.SELLER) {
    throw AppError.fail(
      "You do not have permission to perform this action.",
      403,
    );
  }

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
              attributes: ["firstName", "lastName", "avatar"],
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

  const trustByCustomerId = await getCustomersOrderTrustStats(
    rows.map((order) => order.customer?.id).filter(Boolean),
  );

  const formattedOrders = rows.map((order) => {
    const customer = mapCustomerSummary(
      order.customer,
      order.customer?.user,
      trustByCustomerId.get(order.customer?.id),
    );
    const firstName = customer?.firstName || "";
    const lastName = customer?.lastName || "";

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: `${firstName} ${lastName}`.trim() || "عميل غير معروف",
      customer,
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

const resolveSellerProductForOrders = async (
  sellerId,
  { productId, productName },
) => {
  if (productId) {
    const product = await Product.findOne({
      where: { id: productId, sellerId, isDeleted: false },
      attributes: ["id", "name"],
    });
    if (!product) throw AppError.fail("Product not found.", 404);
    return { product, matches: null };
  }

  const search = productName?.trim();
  if (!search) {
    throw AppError.fail("Product ID or product name is required.", 400);
  }

  const matches = await Product.findAll({
    where: {
      sellerId,
      isDeleted: false,
      name: { [Op.like]: `%${search}%` },
    },
    attributes: ["id", "name", "price", "status"],
    order: [["created_at", "DESC"]],
    limit: 10,
  });

  if (!matches.length) throw AppError.fail("Product not found.", 404);

  const exactMatch = matches.find(
    (product) => product.name.toLowerCase() === search.toLowerCase(),
  );

  if (exactMatch || matches.length === 1) {
    return { product: exactMatch || matches[0], matches: null };
  }

  return { product: null, matches };
};

const listProductOrders = async (req) => {
  const seller = await getSellerFromRequest(req);
  if (!seller) throw AppError.fail("Seller not found.", 404);
  const sellerId = seller.id;

  const { product, matches } = await resolveSellerProductForOrders(sellerId, {
    productId: req.query.productId,
    productName: req.query.productName,
  });

  if (matches) {
    return {
      requiresSelection: true,
      message: "Multiple matching products found. Choose one product ID.",
      products: matches.map((match) => ({
        id: match.id,
        name: match.name,
        price: match.price,
        status: match.status,
      })),
    };
  }

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

  const { count, rows } = await Order.findAndCountAll({
    where,
    attributes: ["id", "orderNumber", "status", "totalPrice", "created_at"],
    include: [
      {
        model: OrderItem,
        as: "items",
        where: { productId: product.id },
        attributes: [
          "id",
          "productId",
          "productName",
          "unitPrice",
          "quantity",
          "lineTotal",
        ],
      },
      {
        model: Customer,
        as: "customer",
        attributes: ["id"],
        include: [
          {
            model: User,
            as: "user",
            attributes: ["firstName", "lastName", "avatar"],
          },
        ],
      },
    ],
    order: [["created_at", "DESC"]],
    limit,
    offset,
    distinct: true,
  });

  const quantityRows = await OrderItem.findAll({
    attributes: [[fn("SUM", col("quantity")), "totalQuantity"]],
    where: { productId: product.id },
    include: [
      {
        model: Order,
        as: "order",
        attributes: [],
        where,
      },
    ],
    raw: true,
  });

  const trustByCustomerId = await getCustomersOrderTrustStats(
    rows.map((order) => order.customer?.id).filter(Boolean),
  );

  const orders = rows.map((order) => {
    const customer = mapCustomerSummary(
      order.customer,
      order.customer?.user,
      trustByCustomerId.get(order.customer?.id),
    );
    const item = order.items?.[0] || null;

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      date: order.created_at,
      totalPrice: order.totalPrice,
      customer,
      item: item
        ? {
            id: item.id,
            productId: item.productId,
            productName: item.productName,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            lineTotal: item.lineTotal,
          }
        : null,
    };
  });

  const totalPages = Math.ceil(count / limit);
  return {
    product: {
      id: product.id,
      name: product.name,
    },
    orders,
    summary: {
      ordersCount: count,
      totalQuantity: Number(quantityRows[0]?.totalQuantity || 0),
    },
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
            attributes: ["firstName", "lastName", "phone", "avatar"],
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
  const orderTrust = await getCustomerOrderTrustStats(order.customer?.id);
  const customerSummary = mapCustomerSummary(
    order.customer,
    order.customer?.user,
    orderTrust,
  );
  const orderJson = order.toJSON();

  return {
    order: {
      ...orderJson,
      customer: customerSummary
        ? {
            ...customerSummary,
            phone: order.customer?.user?.phone ?? null,
          }
        : null,
    },
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

  const customer = await Customer.findByPk(order.customerId, {
    attributes: ["userId"],
  });
  if (customer?.userId) {
    await notificationService.notifySafely({
      recipientUserIds: [customer.userId],
      senderId: req.user?.id || req.user?.userId || null,
      type: NOTIFICATION_TYPES.ORDER,
      title: "تحديث حالة الطلب",
      content: `تم تحديث حالة طلبك ${order.orderNumber} إلى "${STATUS_LABELS[nextStatus]}"`,
      relatedOrderId: order.id,
      actionUrl: `/orders/${order.id}`,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: nextStatus,
      },
    });
  }

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

  const customer = await Customer.findByPk(order.customerId, {
    attributes: ["userId"],
  });
  if (customer?.userId) {
    await notificationService.notifySafely({
      recipientUserIds: [customer.userId],
      senderId: req.user?.id || req.user?.userId || null,
      type: NOTIFICATION_TYPES.ORDER,
      title: "تم رفض الطلب",
      content: `تم رفض طلبك ${order.orderNumber}. السبب: ${order.rejectionReason}`,
      relatedOrderId: order.id,
      actionUrl: `/orders/${order.id}`,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: ORDER_STATUSES.REJECTED,
      },
    });
  }

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
  listProductOrders,
  getOrderDetails,
  updateOrderStatus,
  rejectOrder,
  getSellerOrderStats,
};
