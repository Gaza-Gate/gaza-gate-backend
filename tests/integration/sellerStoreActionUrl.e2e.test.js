/**
 * E2E: seller.actionUrl (/store/:sellerId) across product, store, cart,
 * wishlist, orders, and conversation surfaces.
 */
require("dotenv").config();

jest.mock("../../services/notification/notification.service.js", () => ({
  notifySafely: jest.fn().mockResolvedValue(null),
  createNotification: jest.fn().mockResolvedValue(null),
  getNotifications: jest.fn(),
  markAllAsRead: jest.fn(),
  markAsRead: jest.fn(),
  deleteAllNotifications: jest.fn(),
  deleteNotification: jest.fn(),
  getNotificationStats: jest.fn(),
}));

const request = require("supertest");
const { Op } = require("sequelize");
const app = require("../../app.js");
const { sequelize } = require("../../config/db.config.js");
require("../../models/associations.js");

const Role = require("../../models/role.model.js");
const User = require("../../models/user.model.js");
const Customer = require("../../models/customer.model.js");
const Seller = require("../../models/seller.model.js");
const Category = require("../../models/category.model.js");
const Product = require("../../models/product.model.js");
const Order = require("../../models/order.model.js");
const OrderItem = require("../../models/orderItem.model.js");
const Cart = require("../../models/cart.model.js");
const CartItem = require("../../models/cartItem.model.js");
const Wishlist = require("../../models/wishlist.model.js");
const Conversation = require("../../models/conversation.model.js");
const Message = require("../../models/message.model.js");
const USER_ROLES = require("../../constants/user/userRoles.constant.js");
const ORDER_STATUSES = require("../../constants/order/orderStatuses.constant.js");
const PRODUCT_STATUS = require("../../constants/product/productStatus.constant.js");
const PRODUCT_STOCK_TYPES = require("../../constants/product/stockType.constant.js");
const tokenUtil = require("../../utils/security/token.util.js");

const stamp = Date.now();
const EMAIL_PREFIX = "e2e.actionurl.";
const SELLER_AVATAR = `https://cdn.example/e2e-seller-${stamp}.png`;

const ctx = {
  customerUser: null,
  sellerUser: null,
  customer: null,
  seller: null,
  product: null,
  order: null,
  orderItem: null,
  conversationId: null,
  customerToken: null,
  sellerToken: null,
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });

const expectSellerStoreLink = (sellerPayload, sellerId, avatar = SELLER_AVATAR) => {
  expect(sellerPayload).toMatchObject({
    id: sellerId,
    avatar,
    actionUrl: `/store/${sellerId}`,
  });
  expect(sellerPayload.actionUrl).toMatch(/^\/store\/.+/);
};

async function wipeLeftovers() {
  const leftoverUsers = await User.findAll({
    where: { email: { [Op.like]: `${EMAIL_PREFIX}%@test.local` } },
    attributes: ["id"],
  });

  for (const user of leftoverUsers) {
    const customer = await Customer.findOne({ where: { userId: user.id } });
    const seller = await Seller.findOne({ where: { userId: user.id } });

    if (customer) {
      const conversations = await Conversation.findAll({
        where: { customerId: user.id },
        attributes: ["id"],
      });
      for (const conversation of conversations) {
        await Message.destroy({
          where: { conversationId: conversation.id },
          force: true,
        });
      }
      await Conversation.destroy({
        where: { customerId: user.id },
        force: true,
      });

      const cart = await Cart.findOne({ where: { customerId: customer.id } });
      if (cart) {
        await CartItem.destroy({ where: { cartId: cart.id }, force: true });
        await Cart.destroy({ where: { id: cart.id }, force: true });
      }
      await Wishlist.destroy({
        where: { customerId: customer.id },
        force: true,
      });

      const orders = await Order.findAll({
        where: { customerId: customer.id },
        attributes: ["id"],
      });
      for (const order of orders) {
        await OrderItem.destroy({ where: { orderId: order.id }, force: true });
      }
      await Order.destroy({ where: { customerId: customer.id }, force: true });
      await Customer.destroy({ where: { id: customer.id }, force: true });
    }

    if (seller) {
      await Conversation.destroy({
        where: { sellerId: user.id },
        force: true,
      });
      const products = await Product.findAll({
        where: { sellerId: seller.id },
        attributes: ["id"],
      });
      for (const product of products) {
        await Product.destroy({ where: { id: product.id }, force: true });
      }
      await Order.destroy({ where: { sellerId: seller.id }, force: true });
      await Seller.destroy({ where: { id: seller.id }, force: true });
    }

    await User.destroy({ where: { id: user.id }, force: true });
  }
}

async function seed() {
  await wipeLeftovers();

  const [customerRole, sellerRole, category] = await Promise.all([
    Role.findOne({ where: { name: USER_ROLES.CUSTOMER } }),
    Role.findOne({ where: { name: USER_ROLES.SELLER } }),
    Category.findOne({ attributes: ["id"] }),
  ]);

  if (!customerRole || !sellerRole) {
    throw new Error("Roles missing. Run seedRoles first.");
  }
  if (!category) {
    throw new Error("No category found. Seed at least one category.");
  }

  ctx.customerUser = await User.create({
    activeRoleId: customerRole.id,
    firstName: "E2E",
    lastName: "ActionUrlCustomer",
    email: `${EMAIL_PREFIX}customer.${stamp}@test.local`,
    isVerified: true,
    status: "active",
    tokenVersion: 0,
  });

  ctx.sellerUser = await User.create({
    activeRoleId: sellerRole.id,
    firstName: "E2E",
    lastName: "ActionUrlSeller",
    email: `${EMAIL_PREFIX}seller.${stamp}@test.local`,
    avatar: SELLER_AVATAR,
    isVerified: true,
    status: "active",
    tokenVersion: 0,
  });

  ctx.customer = await Customer.create({ userId: ctx.customerUser.id });
  ctx.seller = await Seller.create({
    userId: ctx.sellerUser.id,
    storeName: `E2E ActionUrl Store ${stamp}`,
    storeDescription: "Temporary store for actionUrl e2e",
  });

  ctx.product = await Product.create({
    sellerId: ctx.seller.id,
    categoryId: category.id,
    name: `E2E ActionUrl Product ${stamp}`,
    description: "Temporary product for actionUrl e2e",
    price: 19.99,
    stockType: PRODUCT_STOCK_TYPES.UNLIMITED,
    status: PRODUCT_STATUS.ACTIVE,
    averageRating: 0,
    reviewsCount: 0,
  });

  ctx.order = await Order.create({
    orderNumber: `E2E-AU-${stamp}`,
    customerId: ctx.customer.id,
    sellerId: ctx.seller.id,
    status: ORDER_STATUSES.COMPLETED,
    paymentMethod: "cash_on_delivery",
    paymentStatus: "paid",
    shippingNeighborhood: "Test",
    shippingStreet: "Test Street",
    subtotal: 19.99,
    discountAmount: 0,
    shippingFee: 0,
    totalPrice: 19.99,
    completedAt: new Date(),
  });

  ctx.orderItem = await OrderItem.create({
    orderId: ctx.order.id,
    productId: ctx.product.id,
    productName: ctx.product.name,
    unitPrice: 19.99,
    quantity: 1,
    lineTotal: 19.99,
  });

  ctx.customerToken = tokenUtil.signAccessToken(
    tokenUtil.buildTokenPayload({
      userId: ctx.customerUser.id,
      role: USER_ROLES.CUSTOMER,
      tokenVersion: 0,
    }),
  );

  ctx.sellerToken = tokenUtil.signAccessToken(
    tokenUtil.buildTokenPayload({
      userId: ctx.sellerUser.id,
      role: USER_ROLES.SELLER,
      tokenVersion: 0,
    }),
  );
}

async function cleanup() {
  if (ctx.conversationId) {
    await Message.destroy({
      where: { conversationId: ctx.conversationId },
      force: true,
    });
    await Conversation.destroy({
      where: { id: ctx.conversationId },
      force: true,
    });
  }

  if (ctx.customer?.id) {
    const cart = await Cart.findOne({ where: { customerId: ctx.customer.id } });
    if (cart) {
      await CartItem.destroy({ where: { cartId: cart.id }, force: true });
      await Cart.destroy({ where: { id: cart.id }, force: true });
    }
    await Wishlist.destroy({
      where: { customerId: ctx.customer.id },
      force: true,
    });
  }

  if (ctx.orderItem?.id) {
    await OrderItem.destroy({ where: { id: ctx.orderItem.id }, force: true });
  }
  if (ctx.order?.id) {
    await Order.destroy({ where: { id: ctx.order.id }, force: true });
  }
  if (ctx.product?.id) {
    await Product.destroy({ where: { id: ctx.product.id }, force: true });
  }
  if (ctx.customer?.id) {
    await Customer.destroy({ where: { id: ctx.customer.id }, force: true });
  }
  if (ctx.seller?.id) {
    await Seller.destroy({ where: { id: ctx.seller.id }, force: true });
  }
  if (ctx.customerUser?.id) {
    await User.destroy({ where: { id: ctx.customerUser.id }, force: true });
  }
  if (ctx.sellerUser?.id) {
    await User.destroy({ where: { id: ctx.sellerUser.id }, force: true });
  }
}

describe("seller store actionUrl e2e", () => {
  jest.setTimeout(60000);

  beforeAll(async () => {
    await sequelize.authenticate();
    await seed();
  }, 60000);

  afterAll(async () => {
    try {
      await cleanup();
    } finally {
      await sequelize.close();
    }
  }, 60000);

  test("product list includes seller.actionUrl", async () => {
    const res = await request(app).get("/api/product/public");

    expect(res.status).toBe(200);
    const listed = res.body.data.products.find((p) => p.id === ctx.product.id);
    expect(listed).toBeTruthy();
    expectSellerStoreLink(listed.seller, ctx.seller.id);
    expect(listed.seller.storeName).toBe(ctx.seller.storeName);
  });

  test("product details includes seller.actionUrl", async () => {
    const res = await request(app).get(`/api/product/public/${ctx.product.id}`);

    expect(res.status).toBe(200);
    expectSellerStoreLink(res.body.data.product.seller, ctx.seller.id);
  });

  test("public store includes store.actionUrl", async () => {
    const res = await request(app)
      .get(`/api/customer/store/${ctx.seller.id}`)
      .set(auth(ctx.customerToken));

    expect(res.status).toBe(200);
    expect(res.body.data.store).toMatchObject({
      id: ctx.seller.id,
      actionUrl: `/store/${ctx.seller.id}`,
      avatar: SELLER_AVATAR,
      user: { avatar: SELLER_AVATAR },
    });
  });

  test("store products includes store.actionUrl summary", async () => {
    const res = await request(app)
      .get(`/api/customer/store/${ctx.seller.id}/products`)
      .set(auth(ctx.customerToken));

    expect(res.status).toBe(200);
    expectSellerStoreLink(res.body.data.store, ctx.seller.id);
  });

  test("wishlist product seller has actionUrl", async () => {
    const addRes = await request(app)
      .post("/api/customer/wishlist")
      .set(auth(ctx.customerToken))
      .send({ productId: ctx.product.id });
    expect([200, 201]).toContain(addRes.status);

    const res = await request(app)
      .get("/api/customer/wishlist")
      .set(auth(ctx.customerToken));

    expect(res.status).toBe(200);
    const item = res.body.data.items.find(
      (row) => row.product?.id === ctx.product.id,
    );
    expect(item).toBeTruthy();
    expectSellerStoreLink(item.product.seller, ctx.seller.id);
  });

  test("cart product seller has actionUrl", async () => {
    const addRes = await request(app)
      .post("/api/customer/cart")
      .set(auth(ctx.customerToken))
      .send({ productId: ctx.product.id, quantity: 1 });
    expect([200, 201]).toContain(addRes.status);

    const res = await request(app)
      .get("/api/customer/cart")
      .set(auth(ctx.customerToken));

    expect(res.status).toBe(200);
    const item = res.body.data.items.find(
      (row) => row.product?.id === ctx.product.id,
    );
    expect(item).toBeTruthy();
    expectSellerStoreLink(item.product.seller, ctx.seller.id);
  });

  test("customer orders list + details include seller.actionUrl", async () => {
    const listRes = await request(app)
      .get("/api/customer/order")
      .set(auth(ctx.customerToken));

    expect(listRes.status).toBe(200);
    const listed = listRes.body.data.orders.find((o) => o.id === ctx.order.id);
    expect(listed).toBeTruthy();
    expectSellerStoreLink(listed.seller, ctx.seller.id);

    const detailsRes = await request(app)
      .get(`/api/customer/order/${ctx.order.id}`)
      .set(auth(ctx.customerToken));

    expect(detailsRes.status).toBe(200);
    expectSellerStoreLink(detailsRes.body.data.order.seller, ctx.seller.id);
  });

  test("conversation otherParty (seller peer) has sellerId + actionUrl", async () => {
    const startRes = await request(app)
      .post("/api/conversations")
      .set(auth(ctx.customerToken))
      .send({ sellerId: ctx.seller.id, productId: ctx.product.id });

    expect([200, 201]).toContain(startRes.status);
    ctx.conversationId = startRes.body.data.conversation.id;
    expect(ctx.conversationId).toBeTruthy();

    const listRes = await request(app)
      .get("/api/conversations")
      .set(auth(ctx.customerToken));

    expect(listRes.status).toBe(200);
    const listed = listRes.body.data.conversations.find(
      (c) => c.id === ctx.conversationId,
    );
    expect(listed).toBeTruthy();
    expect(listed.otherParty).toMatchObject({
      sellerId: ctx.seller.id,
      actionUrl: `/store/${ctx.seller.id}`,
      storeName: ctx.seller.storeName,
    });

    const detailsRes = await request(app)
      .get(`/api/conversations/${ctx.conversationId}`)
      .set(auth(ctx.customerToken));

    expect(detailsRes.status).toBe(200);
    expect(detailsRes.body.data.conversation.otherParty).toMatchObject({
      sellerId: ctx.seller.id,
      actionUrl: `/store/${ctx.seller.id}`,
      storeName: ctx.seller.storeName,
    });
  });
});
