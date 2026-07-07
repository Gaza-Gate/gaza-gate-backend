const { Op } = require("sequelize");
const Cart = require("../models/cart.model.js");
const CartItem = require("../models/cartItem.model.js");
const Product = require("../models/product.model.js");
const ProductImage = require("../models/productImage.model.js");
const Seller = require("../models/seller.model.js");
const Customer = require("../models/customer.model.js");
const AppError = require("../utils/AppError.util.js");
const resolveCustomerIdFromRequest = require("../utils/resolveCustomerIdFromRequest.util.js");
const PAGINATION = require("../constants/pagination.constant.js");
const PRODUCT_STATUS = require("../constants/productStatus.constants.js");
const PRODUCT_STOCK_TYPES = require("../constants/stockType.constants.js");

const getCart = async (req) => {
  const customerId = await resolveCustomerIdFromRequest(req);
  if (!customerId) throw AppError.fail("Customer not found.", 404);

  const page = Math.max(Number(req.query.page) || PAGINATION.DEFAULT_PAGE, 1);
  const limit = PAGINATION.DEFAULT_LIMIT;
  const offset = (page - 1) * limit;

  const cart = await Cart.findOne({
    where: { customerId },
  });

  if (!cart) {
    // Return empty cart
    return {
      items: [],
      cartTotal: 0,
      pagination: {
        totalItems: 0,
        totalPages: 0,
        currentPage: page,
        pageSize: limit,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
  }

  const { count, rows } = await CartItem.findAndCountAll({
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
          "created_at",
        ],
        include: [
          {
            model: Seller,
            as: "seller",
            attributes: ["id", "storeName"],
          },
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
    order: [["created_at", "DESC"]],
    limit,
    offset,
    distinct: true,
  });

  const totalPages = Math.ceil(count / limit);

  const items = rows.map((cartItem) => {
    const product = cartItem.product;
    const primaryImage = product?.images?.[0];

    return {
      id: cartItem.id,
      quantity: cartItem.quantity,
      createdAt: cartItem.created_at,
      product: product
        ? {
            id: product.id,
            name: product.name,
            price: product.price,
            stockType: product.stockType,
            quantity: product.quantity,
            status: product.status,
            seller: product.seller
              ? { id: product.seller.id, storeName: product.seller.storeName }
              : null,
            imageUrl: primaryImage?.imageUrl ?? null,
          }
        : null,
    };
  });

  // Calculate cart total
  const cartTotal = items.reduce((sum, item) => {
    return (
      sum + (item.product ? parseFloat(item.product.price) * item.quantity : 0)
    );
  }, 0);

  return {
    items,
    cartTotal: parseFloat(cartTotal.toFixed(2)),
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

const addToCart = async (req) => {
  const customerId = await resolveCustomerIdFromRequest(req);
  if (!customerId) throw AppError.fail("Customer not found.", 404);

  const { productId, quantity = 1 } = req.body;

  // Validate inputs
  if (!productId) throw AppError.fail("productId is required.", 400);
  if (!quantity || quantity < 1)
    throw AppError.fail("quantity must be at least 1.", 400);

  // Check if product exists and is active
  const product = await Product.findByPk(productId, {
    attributes: [
      "id",
      "name",
      "price",
      "stockType",
      "quantity",
      "status",
      "isDeleted",
    ],
  });

  if (!product || product.isDeleted)
    throw AppError.fail("Product not found.", 404);
  if (product.status !== PRODUCT_STATUS.ACTIVE)
    throw AppError.fail("Product is not available.", 400);

  // Validate stock availability
  if (product.stockType === PRODUCT_STOCK_TYPES.LIMITED) {
    if (!product.quantity || product.quantity < quantity) {
      throw AppError.fail(
        `Insufficient stock. Available: ${product.quantity || 0}`,
        400,
      );
    }
  }

  // Get or create cart
  let cart = await Cart.findOne({ where: { customerId } });
  if (!cart) {
    cart = await Cart.create({ customerId });
  }

  // Check if product already in cart
  const existingCartItem = await CartItem.findOne({
    where: { cartId: cart.id, productId },
  });

  let cartItem;
  if (existingCartItem) {
    // Update quantity
    const newQuantity = existingCartItem.quantity + quantity;

    // Validate new quantity against stock
    if (product.stockType === PRODUCT_STOCK_TYPES.LIMITED) {
      if (newQuantity > product.quantity) {
        throw AppError.fail(
          `Cannot add. Maximum available: ${product.quantity}`,
          400,
        );
      }
    }

    cartItem = await existingCartItem.update({ quantity: newQuantity });
  } else {
    // Create new cart item
    cartItem = await CartItem.create({
      cartId: cart.id,
      productId,
      quantity,
    });
  }

  return cartItem;
};

const updateCartItem = async (req) => {
  const customerId = await resolveCustomerIdFromRequest(req);
  if (!customerId) throw AppError.fail("Customer not found.", 404);

  const { cartItemId } = req.params;
  const { quantity } = req.body;

  // Validate quantity
  if (!quantity || quantity < 1)
    throw AppError.fail("quantity must be at least 1.", 400);

  // Find cart item
  const cartItem = await CartItem.findByPk(cartItemId, {
    include: [
      {
        model: Cart,
        as: "cart",
        attributes: ["customerId"],
      },
      {
        model: Product,
        as: "product",
        attributes: ["id", "stockType", "quantity", "isDeleted"],
      },
    ],
  });

  if (!cartItem) throw AppError.fail("Cart item not found.", 404);

  // Verify cart belongs to customer
  if (cartItem.cart.customerId !== customerId) {
    throw AppError.fail("Unauthorized.", 403);
  }

  // Check if product still exists and is not deleted
  if (cartItem.product.isDeleted) {
    throw AppError.fail("Product is no longer available.", 400);
  }

  // Validate stock availability
  if (cartItem.product.stockType === PRODUCT_STOCK_TYPES.LIMITED) {
    if (quantity > cartItem.product.quantity) {
      throw AppError.fail(
        `Insufficient stock. Available: ${cartItem.product.quantity}`,
        400,
      );
    }
  }

  // Update quantity
  const updatedCartItem = await cartItem.update({ quantity });
  return updatedCartItem;
};

const removeFromCart = async (req) => {
  const customerId = await resolveCustomerIdFromRequest(req);
  if (!customerId) throw AppError.fail("Customer not found.", 404);

  const { cartItemId } = req.params;

  // Find cart item
  const cartItem = await CartItem.findByPk(cartItemId, {
    include: [
      {
        model: Cart,
        as: "cart",
        attributes: ["customerId"],
      },
    ],
  });

  if (!cartItem) throw AppError.fail("Cart item not found.", 404);

  // Verify cart belongs to customer
  if (cartItem.cart.customerId !== customerId) {
    throw AppError.fail("Unauthorized.", 403);
  }

  // Delete cart item
  await cartItem.destroy();

  return { message: "Cart item removed." };
};

const clearCart = async (req) => {
  const customerId = await resolveCustomerIdFromRequest(req);
  if (!customerId) throw AppError.fail("Customer not found.", 404);

  const cart = await Cart.findOne({ where: { customerId } });
  if (!cart) throw AppError.fail("Cart not found.", 404);

  const deletedCount = await CartItem.destroy({ where: { cartId: cart.id } });

  return { message: "Cart cleared.", deletedCount };
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
};
