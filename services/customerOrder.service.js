const { sequelize } = require("../config/db.config.js");
const Cart = require("../models/cart.model.js");
const CartItem = require("../models/cartItem.model.js");
const Customer = require("../models/customer.model.js");
const Order = require("../models/order.model.js");
const OrderItem = require("../models/orderItem.model.js");
const Product = require("../models/product.model.js");
const ProductImage = require("../models/productImage.model.js");
const Seller = require("../models/seller.model.js");
const Address = require("../models/address.model.js");
const AppError = require("../utils/AppError.util.js");
const ORDER_STATUSES = require("../constants/orderStatuses.constant.js");
const PAGINATION = require("../constants/pagination.constant.js");
const PRODUCT_STATUS = require("../constants/productStatus.constants.js");
const PRODUCT_STOCK_TYPES = require("../constants/stockType.constants.js");

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

  const cart = await Cart.findOne({
    where: { customerId: customer.id },
    include: [
      {
        model: CartItem,
        as: "items",
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
      },
    ],
  });

  console.log(cart);
  console.log(cart.items);
  console.log(cart.items.length);

  if (!cart || !cart.items?.length) {
    throw AppError.fail("Your cart is empty.", 400);
  }

  const itemsBySeller = {};
  for (const item of cart.items) {
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

  const createdOrders = [];
  const transaction = await sequelize.transaction();

  try {
    for (const sellerId of Object.keys(itemsBySeller)) {
      const sellerItems = itemsBySeller[sellerId];
      let totalPrice = 0;

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

        const lineTotal = Number(productInDb.price) * item.quantity;
        totalPrice += lineTotal;
        validatedItems.push({
          item,
          product: productInDb,
          lineTotal,
        });
      }

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
          totalPrice: Number(totalPrice.toFixed(2)),
        },
        { transaction },
      );

      for (const entry of validatedItems) {
        const { item, product, lineTotal } = entry;
        await OrderItem.create(
          {
            orderId: order.id,
            productId: product.id,
            productName: product.name,
            unitPrice: Number(product.price),
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
      {
        model: Seller,
        as: "seller",
        attributes: ["id", "storeName"],
      },
      {
        model: OrderItem,
        as: "items",
        attributes: ["id", "productName", "unitPrice", "quantity", "lineTotal"],
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

  const orders = rows.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    totalPrice: Number(order.totalPrice),
    paymentMethod: order.paymentMethod,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    seller: order.seller
      ? { id: order.seller.id, storeName: order.seller.storeName }
      : null,
    items: (order.items || []).map((item) => ({
      id: item.id,
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
      {
        model: Seller,
        as: "seller",
        attributes: ["id", "storeName"],
      },
      {
        model: OrderItem,
        as: "items",
        attributes: ["id", "productName", "unitPrice", "quantity", "lineTotal"],
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

  return {
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalPrice: Number(order.totalPrice),
      paymentMethod: order.paymentMethod,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      canCancel: order.status === ORDER_STATUSES.PENDING_REVIEW,
      seller: order.seller
        ? { id: order.seller.id, storeName: order.seller.storeName }
        : null,
      items: (order.items || []).map((item) => ({
        id: item.id,
        productName: item.productName,
        unitPrice: Number(item.unitPrice),
        quantity: item.quantity,
        lineTotal: Number(item.lineTotal),
        primaryImage: item.product?.images?.[0]?.imageUrl || null,
      })),
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
