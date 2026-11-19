const { sequelize } = require("../../config/db.config.js");
const Cart = require("../../models/cart.model.js");
const CartItem = require("../../models/cartItem.model.js");
const Customer = require("../../models/customer.model.js");
const Order = require("../../models/order.model.js");
const OrderItem = require("../../models/orderItem.model.js");
const Product = require("../../models/product.model.js");
const ProductImage = require("../../models/productImage.model.js");
const Seller = require("../../models/seller.model.js");
const Address = require("../../models/address.model.js");
const User = require("../../models/user.model.js");
const AppError = require("../../utils/http/AppError.util.js");
const ORDER_STATUSES = require("../../constants/order/orderStatuses.constant.js");
const PAGINATION = require("../../constants/shared/pagination.constant.js");
const PRODUCT_STATUS = require("../../constants/product/productStatus.constant.js");
const PRODUCT_STOCK_TYPES = require("../../constants/product/stockType.constant.js");
const NOTIFICATION_TYPES = require("../../constants/notification/notificationTypes.constant.js");
const notificationService = require("../notification/notification.service.js");
const { mapSellerSummary } = require("../../utils/navigation/sellerStoreLink.util.js");
const {
  getSellersOrderTrustStats,
  getSellerOrderTrustStats,
} = require("../../utils/navigation/sellerTrustStats.util.js");
const { computeOrderTotals } = require("../../utils/order/orderTotals.util.js");

const sellerSummaryInclude = {
  model: Seller,
  as: "seller",
  attributes: ["id", "storeName", "rating", "ratingCount"],
  include: [
    {
      model: User,
      as: "user",
      attributes: ["avatar"],
    },
  ],
};

const generateOrderNumber = () => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `ORD-${timestamp}${random}`;
};

const ensureCustomerAccess = (req) => {
  if (req.user?.role !== "customer") {
    throw AppError.fail("Access denied.", 403);
  }
};

const getCustomerFromRequest = async (req) => {
  const userId = req.user?.userId || req.user?.id;
  if (!userId) return null;

  return Customer.findOne({
    where: { userId },
    attributes: ["id"],
  });
};

const createOrder = async (req) => {
  ensureCustomerAccess(req);

  const { paymentMethod } = req.body || {};
  if (!paymentMethod) {
    throw AppError.fail("paymentMethod is required.", 400);
  }
  if (paymentMethod !== "cash_on_delivery") {
    throw AppError.fail("Only cash on delivery is available.", 400);
  }

  const customer = await getCustomerFromRequest(req);
  if (!customer) {
    throw AppError.fail("Customer not found.", 404);
  }

  const customerAddress = await Address.findOne({
    where: { userId: req.user?.id || req.user?.userId },
    attributes: ["neighborhood", "street", "notes"],
    order: [["created_at", "ASC"]],
  });

  const createdOrders = [];
  const transaction = await sequelize.transaction();

  try {
    // Lock the cart row so concurrent checkouts for the same customer serialize.
    // The second request waits here, then sees an empty cart after the first commits.
    const cart = await Cart.findOne({
      where: { customerId: customer.id },
      attributes: ["id"],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!cart) {
      throw AppError.fail("Your cart is empty.", 400);
    }

    const cartItems = await CartItem.findAll({
      where: { cartId: cart.id },
      include: [
        {
          model: Product,
          as: "product",
          attributes: [
            "id",
            "name",
            "price",
            "stockType",
            "quantity",
            "status",
            "isDeleted",
            "sellerId",
          ],
        },
      ],
      transaction,
    });

    if (!cartItems.length) {
      throw AppError.fail("Your cart is empty.", 400);
    }

    const itemsBySeller = {};
    for (const item of cartItems) {
      const product = item.product;
      if (
        !product ||
        product.isDeleted ||
        product.status !== PRODUCT_STATUS.ACTIVE
      ) {
        throw AppError.fail(
          `Product "${product?.name || "unknown"}" is no longer available.`,
          400,
        );
      }

      const sellerId = product.sellerId;
      if (!itemsBySeller[sellerId]) {
        itemsBySeller[sellerId] = [];
      }
      itemsBySeller[sellerId].push(item);
    }

    const customerUserId = req.user?.id || req.user?.userId;
    const sellerIds = Object.keys(itemsBySeller);
    const sellers = await Seller.findAll({
      where: { id: sellerIds },
      attributes: ["id", "userId"],
      transaction,
    });
    for (const seller of sellers) {
      if (seller.userId === customerUserId) {
        throw AppError.fail("You cannot order from your own store.", 400);
      }
    }

    for (const sellerId of sellerIds) {
      const sellerItems = itemsBySeller[sellerId];

      const validatedItems = [];
      for (const item of sellerItems) {
        const product = item.product;
        const productInDb = await Product.findOne({
          where: { id: product.id },
          attributes: [
            "id",
            "name",
            "price",
            "stockType",
            "quantity",
            "status",
            "isDeleted",
          ],
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (
          !productInDb ||
          productInDb.isDeleted ||
          productInDb.status !== PRODUCT_STATUS.ACTIVE
        ) {
          throw AppError.fail(
            `Product "${productInDb?.name || product.name}" is no longer available.`,
            400,
          );
        }

        if (
          productInDb.stockType === PRODUCT_STOCK_TYPES.LIMITED &&
          productInDb.quantity < item.quantity
        ) {
          throw AppError.fail(
            `Insufficient stock for "${productInDb.name}". Available: ${productInDb.quantity}, Requested: ${item.quantity}`,
            400,
          );
        }

        const unitPrice = Number(productInDb.price);
        const lineTotal = unitPrice * item.quantity;
        validatedItems.push({
          item,
          product: productInDb,
          unitPrice,
          quantity: item.quantity,
          lineTotal,
        });
      }

      const discountAmount = 0;
      const shippingFee = 0;
      const { subtotal, totalPrice } = computeOrderTotals({
        items: validatedItems,
        discountAmount,
        shippingFee,
      });

      const order = await Order.create(
        {
          customerId: customer.id,
          sellerId,
          orderNumber: generateOrderNumber(),
          status: ORDER_STATUSES.PENDING_REVIEW,
          paymentMethod: "cash_on_delivery",
          shippingNeighborhood: customerAddress?.neighborhood || "N/A",
          shippingStreet: customerAddress?.street || "N/A",
          shippingNotes: customerAddress?.notes || null,
          subtotal,
          discountAmount,
          shippingFee,
          totalPrice,
        },
        { transaction },
      );

      for (const entry of validatedItems) {
        const { item, product, unitPrice, lineTotal } = entry;
        await OrderItem.create(
          {
            orderId: order.id,
            productId: product.id,
            productName: product.name,
            unitPrice,
            quantity: item.quantity,
            lineTotal: Number(lineTotal.toFixed(2)),
          },
          { transaction },
        );

        if (product.stockType === PRODUCT_STOCK_TYPES.LIMITED) {
          await product.update(
            {
              quantity: product.quantity - item.quantity,
            },
            { transaction },
          );
        }
      }

      createdOrders.push({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        subtotal: Number(order.subtotal),
        totalPrice: Number(order.totalPrice),
        sellerId: order.sellerId,
        itemsCount: validatedItems.length,
      });
    }

    await CartItem.destroy({ where: { cartId: cart.id }, transaction });
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }

  const senderId = req.user?.id || req.user?.userId || null;
  for (const created of createdOrders) {
    const seller = await Seller.findByPk(created.sellerId, {
      attributes: ["userId"],
    });
    if (!seller?.userId) continue;

    await notificationService.notifySafely({
      recipientUserIds: [seller.userId],
      senderId,
      type: NOTIFICATION_TYPES.ORDER,
      title: "طلب جديد",
      content: `لديك طلب جديد برقم ${created.orderNumber}`,
      relatedOrderId: created.id,
      actionUrl: `/seller/orders/${created.id}`,
      order: {
        id: created.id,
        orderNumber: created.orderNumber,
        status: created.status,
      },
    });
  }

  return { orders: createdOrders };
};

const getCustomerOrders = async (req) => {
  ensureCustomerAccess(req);

  const customer = await getCustomerFromRequest(req);
  if (!customer) {
    throw AppError.fail("Customer not found.", 404);
  }

  const page = Math.max(Number(req.query.page) || PAGINATION.DEFAULT_PAGE, 1);
  const limit = PAGINATION.DEFAULT_LIMIT;
  const offset = (page - 1) * limit;

  const where = {
    customerId: customer.id,
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
    include: [
      sellerSummaryInclude,
      {
        model: OrderItem,
        as: "items",
        attributes: ["id", "productId", "productName", "unitPrice", "quantity", "lineTotal"],
        include: [
          {
            model: Product,
            as: "product",
            attributes: ["id"],
            include: [
              {
                model: ProductImage,
                as: "images",
                where: { isPrimary: true },
                required: false,
                attributes: ["imageUrl"],
              },
            ],
          },
        ],
      },
    ],
    order: [["created_at", "DESC"]],
    limit,
    offset,
    distinct: true,
  });

  const trustBySellerId = await getSellersOrderTrustStats(
    rows.map((order) => order.seller?.id).filter(Boolean),
  );

  const orders = rows.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    totalPrice: Number(order.totalPrice),
    paymentMethod: order.paymentMethod,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    seller: mapSellerSummary(
      order.seller,
      null,
      trustBySellerId.get(order.seller?.id),
    ),
    items: (order.items || []).map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      unitPrice: Number(item.unitPrice),
      quantity: item.quantity,
      lineTotal: Number(item.lineTotal),
      primaryImage: item.product?.images?.[0]?.imageUrl || null,
    })),
  }));

  const totalPages = Math.ceil(count / limit);
  return {
    orders,
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

const getCustomerOrderDetails = async (req) => {
  ensureCustomerAccess(req);

  const customer = await getCustomerFromRequest(req);
  if (!customer) {
    throw AppError.fail("Customer not found.", 404);
  }

  const order = await Order.findOne({
    where: {
      id: req.params.orderId,
      customerId: customer.id,
      isDeleted: false,
    },
    include: [
      sellerSummaryInclude,
      {
        model: OrderItem,
        as: "items",
        attributes: ["id", "productId", "productName", "unitPrice", "quantity", "lineTotal"],
        include: [
          {
            model: Product,
            as: "product",
            attributes: ["id"],
            include: [
              {
                model: ProductImage,
                as: "images",
                where: { isPrimary: true },
                required: false,
                attributes: ["imageUrl"],
              },
            ],
          },
        ],
      },
    ],
  });

  if (!order) {
    throw AppError.fail("Order not found.", 404);
  }

  const orderTrust = await getSellerOrderTrustStats(order.seller?.id);

  const items = (order.items || []).map((item) => ({
    id: item.id,
    productId: item.productId,
    productName: item.productName,
    unitPrice: Number(item.unitPrice),
    quantity: item.quantity,
    lineTotal: Number(item.lineTotal),
    primaryImage: item.product?.images?.[0]?.imageUrl || null,
  }));

  const totals = computeOrderTotals({
    items,
    discountAmount: order.discountAmount,
    shippingFee: order.shippingFee,
  });

  return {
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      shippingFee: totals.shippingFee,
      totalPrice: totals.totalPrice,
      paymentMethod: order.paymentMethod,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      canCancel: order.status === ORDER_STATUSES.PENDING_REVIEW,
      seller: mapSellerSummary(order.seller, null, orderTrust),
      items,
    },
  };
};

const cancelOrder = async (req) => {
  ensureCustomerAccess(req);

  const customer = await getCustomerFromRequest(req);
  if (!customer) {
    throw AppError.fail("Customer not found.", 404);
  }

  const transaction = await sequelize.transaction();
  try {
    const order = await Order.findOne({
      where: {
        id: req.params.orderId,
        customerId: customer.id,
        isDeleted: false,
      },
      include: [
        {
          model: OrderItem,
          as: "items",
          attributes: ["id", "productId", "quantity"],
        },
      ],
      transaction,
    });

    if (!order) {
      throw AppError.fail("Order not found.", 404);
    }

    if (order.status !== ORDER_STATUSES.PENDING_REVIEW) {
      throw AppError.fail("Order cannot be cancelled at this stage.", 400);
    }

    await order.update(
      {
        status: ORDER_STATUSES.CANCELLED,
        cancelledAt: new Date(),
      },
      { transaction },
    );

    for (const item of order.items || []) {
      const product = await Product.findOne({
        where: { id: item.productId },
        attributes: ["id", "stockType"],
        transaction,
      });

      if (product?.stockType === PRODUCT_STOCK_TYPES.LIMITED) {
        await product.increment("quantity", {
          by: item.quantity,
          transaction,
        });
      }
    }

    await transaction.commit();

    const seller = await Seller.findByPk(order.sellerId, {
      attributes: ["userId"],
    });
    if (seller?.userId) {
      await notificationService.notifySafely({
        recipientUserIds: [seller.userId],
        senderId: req.user?.id || req.user?.userId || null,
        type: NOTIFICATION_TYPES.ORDER,
        title: "تم إلغاء الطلب",
        content: `تم إلغاء الطلب ${order.orderNumber} من قبل العميل`,
        relatedOrderId: order.id,
        actionUrl: `/seller/orders/${order.id}`,
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: ORDER_STATUSES.CANCELLED,
        },
      });
    }

    return {
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: ORDER_STATUSES.CANCELLED,
      },
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

module.exports = {
  createOrder,
  getCustomerOrders,
  getCustomerOrderDetails,
  cancelOrder,
  generateOrderNumber,
};
