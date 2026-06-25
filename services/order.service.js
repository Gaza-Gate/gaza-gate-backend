const { fn, col } = require('sequelize');
const Order = require('../models/order.model');
const OrderItem = require('../models/orderItem.model.js');
const Product = require('../models/product.model.js');
const ProductImage = require('../models/productImage.model.js');
const Customer = require('../models/customer.model.js');
const AppError = require('../utils/AppError.util.js');
const ORDER_STATUS = require('../constants/orderStatuses.constant.js');
const { STATUS_TRANSITIONS, STATUS_LABELS } = require('../constants/orderStatusTransitions.constants.js');
const PAGINATION = require('../constants/pagination.constant.js');

const getSellerIdFromRequest = (req) => req.user?.id || req.user?.sellerId || null;

const getSellerOrderStats = async (sellerId) => {
  const rows = await Order.findAll({
    where: { sellerId, isDeleted: false },
    attributes: ['status', [fn('COUNT', col('id')), 'count']],
    group: ['status'],
    raw: true,
  });

  const map = rows.reduce((acc, row) => {
    acc[row.status] = parseInt(row.count);
    return acc;
  }, {});

  return {
    total: Object.values(map).reduce((s, c) => s + c, 0),
    pending: map[ORDER_STATUS.PENDING] || 0,
    approved: map[ORDER_STATUS.APPROVED] || 0,
    inProgress: map[ORDER_STATUS.IN_PROGRESS] || 0,
    delivered: map[ORDER_STATUS.DELIVERED] || 0,
    completed: map[ORDER_STATUS.COMPLETED] || 0,
    cancelled: map[ORDER_STATUS.CANCELLED] || 0,
  };
};

const getSellerOrders = async (req) => {
  const sellerId = getSellerIdFromRequest(req);
  if (!sellerId) throw new AppError('Seller authentication data is missing.', 401);

  const page = Math.max(Number(req.query.page) || PAGINATION.DEFAULT_PAGE, 1);
  const limit  = PAGINATION.DEFAULT_LIMIT;
  const offset = (page - 1) * limit;
  
  const where = { sellerId, isDeleted: false };
  if (req.query.status && Object.values(ORDER_STATUS).includes(req.query.status)) {
    where.status = req.query.status;
  }
  
  const [{ count, rows }, stats] = await Promise.all([
    Order.findAndCountAll({
      where,
      include: [
        {
          model: Customer,
          attributes: ['id', 'fullName'],
        },
        {
          model: OrderItem,
          attributes: ['id'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    }),
    
    getSellerOrderStats(sellerId),
  ]);

  const totalPages = Math.ceil(count / limit);
  return {
    orders: rows,
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
  const sellerId = getSellerIdFromRequest(req);
  if (!sellerId) throw new AppError('Seller authentication data is missing.', 401);

  const order = await Order.findOne({
    where: { id: req.params.id, sellerId, isDeleted: false },
    include: [
      {
        model: Customer,
        attributes: ['id', 'fullName', 'phone'],
      },
      {
        model: OrderItem,
        include: [
          {
            model: Product,
            attributes: ['id', 'name'],
            include: [
              {
                model: ProductImage,
                where: { isPrimary: true },
                attributes: ['imageUrl'],
                required: false,
                limit:    1,
              },
            ],
          },
        ],
      },
    ],
  });

  if (!order) throw new AppError('Order not found.', 404);

  const nextStatus = STATUS_TRANSITIONS[order.status] || null;
  const nextStatusLabel = nextStatus ? STATUS_LABELS[nextStatus] : null;

  return {
    order,
    workflow: {
      currentStatus: order.status,
      currentLabel: STATUS_LABELS[order.status],
      nextStatus,
      nextStatusLabel,
      canUpdate: !!nextStatus,
    },
  };
};

const updateOrderStatus = async (req) => {
  const sellerId = getSellerIdFromRequest(req);
  if (!sellerId) throw new AppError('Seller authentication data is missing.', 401);

  const order = await Order.findOne({
    where: { id: req.params.id, sellerId, isDeleted: false },
  });
  if (!order) throw new AppError('Order not found.', 404);

  const nextStatus = STATUS_TRANSITIONS[order.status];
  if (!nextStatus) {
    throw new AppError('This order has reached its final status.', 400);
  }

  await order.update({ status: nextStatus });

  // TODO: لما تبني notification module
  // await notificationService.notify(order.customerId, {
  //   type: 'ORDER_STATUS_UPDATED',
  //   orderId: order.id,
  //   orderNumber: order.orderNumber,
  //   newStatus: nextStatus,
  //   newLabel: STATUS_LABELS[nextStatus],
  // });

  return {
    order,
    updatedStatus: nextStatus,
    updatedStatusLabel: STATUS_LABELS[nextStatus],
  };
};

module.exports = {
  getSellerOrders,
  getOrderDetails,
  updateOrderStatus,
  getSellerOrderStats,
};