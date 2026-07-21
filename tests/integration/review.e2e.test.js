/**
 * End-to-end Review flow against real DB + HTTP routes.
 * Seeds temporary users/product/order, then cleans them up.
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
const Review = require("../../models/review.model.js");
const USER_ROLES = require("../../constants/user/userRoles.constant.js");
const ORDER_STATUSES = require("../../constants/order/orderStatuses.constant.js");
const PRODUCT_STATUS = require("../../constants/product/productStatus.constant.js");
const PRODUCT_STOCK_TYPES = require("../../constants/product/stockType.constant.js");
const tokenUtil = require("../../utils/security/token.util.js");

const stamp = Date.now();
const ctx = {
  customerUser: null,
  sellerUser: null,
  customer: null,
  seller: null,
  product: null,
  order: null,
  orderItem: null,
  reviewId: null,
  customerToken: null,
  sellerToken: null,
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });

async function seed() {
  // Remove leftovers from interrupted previous runs
  const leftoverUsers = await User.findAll({
    where: {
      email: {
        [Op.like]: "e2e.review.%@test.local",
      },
    },
    attributes: ["id"],
  });
  for (const user of leftoverUsers) {
    const customer = await Customer.findOne({ where: { userId: user.id } });
    const seller = await Seller.findOne({ where: { userId: user.id } });
    if (customer) {
      await Review.destroy({ where: { customerId: customer.id }, force: true });
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
      const products = await Product.findAll({
        where: { sellerId: seller.id },
        attributes: ["id"],
      });
      for (const product of products) {
        await Review.destroy({ where: { productId: product.id }, force: true });
        await Product.destroy({ where: { id: product.id }, force: true });
      }
      await Order.destroy({ where: { sellerId: seller.id }, force: true });
      await Seller.destroy({ where: { id: seller.id }, force: true });
    }
    await User.destroy({ where: { id: user.id }, force: true });
  }

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
    lastName: "Customer",
    email: `e2e.review.customer.${stamp}@test.local`,
    isVerified: true,
    status: "active",
    tokenVersion: 0,
  });

  ctx.sellerUser = await User.create({
    activeRoleId: sellerRole.id,
    firstName: "E2E",
    lastName: "Seller",
    email: `e2e.review.seller.${stamp}@test.local`,
    isVerified: true,
    status: "active",
    tokenVersion: 0,
  });

  ctx.customer = await Customer.create({ userId: ctx.customerUser.id });
  ctx.seller = await Seller.create({
    userId: ctx.sellerUser.id,
    storeName: `E2E Store ${stamp}`,
    storeDescription: "Temporary store for review e2e tests",
  });

  ctx.product = await Product.create({
    sellerId: ctx.seller.id,
    categoryId: category.id,
    name: `E2E Product ${stamp}`,
    description: "Temporary product",
    price: 25.5,
    stockType: PRODUCT_STOCK_TYPES.UNLIMITED,
    status: PRODUCT_STATUS.ACTIVE,
    averageRating: 0,
    reviewsCount: 0,
  });

  ctx.order = await Order.create({
    orderNumber: `E2E-REV-${stamp}`,
    customerId: ctx.customer.id,
    sellerId: ctx.seller.id,
    status: ORDER_STATUSES.COMPLETED,
    paymentMethod: "cash_on_delivery",
    paymentStatus: "paid",
    shippingNeighborhood: "Test",
    shippingStreet: "Test Street",
    subtotal: 25.5,
    discountAmount: 0,
    shippingFee: 0,
    totalPrice: 25.5,
    completedAt: new Date(),
  });

  ctx.orderItem = await OrderItem.create({
    orderId: ctx.order.id,
    productId: ctx.product.id,
    productName: ctx.product.name,
    unitPrice: 25.5,
    quantity: 1,
    lineTotal: 25.5,
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
  const reviewIds = [];
  if (ctx.reviewId) reviewIds.push(ctx.reviewId);
  if (ctx.product?.id) {
    const extra = await Review.findAll({
      where: { productId: ctx.product.id },
      attributes: ["id"],
    });
    extra.forEach((r) => reviewIds.push(r.id));
  }

  if (reviewIds.length) {
    await Review.destroy({ where: { id: reviewIds }, force: true });
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

describe("Review E2E", () => {
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

  test("1) customer creates a review", async () => {
    const res = await request(app)
      .post("/api/customer/review")
      .set(auth(ctx.customerToken))
      .send({
        productId: ctx.product.id,
        orderId: ctx.order.id,
        rating: 5,
        comment: "E2E excellent product",
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("success");
    expect(res.body.data).toMatchObject({
      productId: ctx.product.id,
      orderId: ctx.order.id,
      rating: 5,
      comment: "E2E excellent product",
    });
    expect(res.body.data.id).toBeTruthy();
    ctx.reviewId = res.body.data.id;

    await ctx.product.reload();
    await ctx.seller.reload();
    expect(Number(ctx.product.reviewsCount)).toBe(1);
    expect(Number(ctx.product.averageRating)).toBe(5);
    expect(Number(ctx.seller.ratingCount)).toBe(1);
    expect(Number(ctx.seller.rating)).toBe(5);
  });

  test("2) GET /my returns the review", async () => {
    const res = await request(app)
      .get("/api/customer/review/my")
      .set(auth(ctx.customerToken));

    expect(res.status).toBe(200);
    expect(res.body.data.reviews.length).toBeGreaterThanOrEqual(1);
    const mine = res.body.data.reviews.find((r) => r.id === ctx.reviewId);
    expect(mine).toBeTruthy();
    expect(mine.product.id).toBe(ctx.product.id);
    expect(mine.seller).toMatchObject({
      id: ctx.seller.id,
      actionUrl: `/store/${ctx.seller.id}`,
    });
    expect(res.body.data.pagination).toMatchObject({
      currentPage: 1,
      hasPreviousPage: false,
    });
  });

  test("3) shared product reviews include stats + list", async () => {
    const res = await request(app)
      .get(`/api/review/product/${ctx.product.id}`)
      .set(auth(ctx.customerToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      averageRating: expect.anything(),
      totalReviews: 1,
      distribution: expect.objectContaining({ 5: 1 }),
    });
    expect(res.body.data.reviews.some((r) => r.id === ctx.reviewId)).toBe(true);
    expect(res.body.data.reviews[0].customer).toMatchObject({
      id: ctx.customer.id,
      firstName: "E2E",
      lastName: "Customer",
    });
  });

  test("4) seller can list store reviews", async () => {
    const res = await request(app)
      .get("/api/seller/review")
      .set(auth(ctx.sellerToken));

    expect(res.status).toBe(200);
    expect(res.body.data.totalReviews).toBe(1);
    expect(
      res.body.data.reviews.some((r) => r.id === ctx.reviewId),
    ).toBe(true);
  });

  test("5) public customer profile returns Phase 2 shape", async () => {
    const res = await request(app)
      .get(`/api/profile/customer/${ctx.customer.id}`)
      .set(auth(ctx.sellerToken));

    expect(res.status).toBe(200);
    expect(res.body.data.customer).toMatchObject({
      id: ctx.customer.id,
      firstName: "E2E",
      lastName: "Customer",
      isTrustedBuyer: false,
    });
    expect(res.body.data.stats).toMatchObject({
      completedOrders: 1,
      completionRate: 100,
      totalReviews: 0,
      averageRating: 0,
    });
    expect(res.body.data.shopping).toMatchObject({
      topCategories: expect.any(Array),
      lastOrderAt: expect.anything(),
    });
    expect(res.body.data.shopping.topCategories.length).toBeGreaterThanOrEqual(
      1,
    );
    expect(res.body.data.sellerReviews).toMatchObject({
      totalReviews: 0,
      averageRating: 0,
      preview: [],
    });
    expect(res.body.data.recentReviews).toBeUndefined();
    expect(res.body.data.customer.email).toBeUndefined();
    expect(res.body.data.customer.phone).toBeUndefined();
  });

  test("6) GET product reviews by customer id (show all)", async () => {
    const res = await request(app)
      .get(`/api/review/customer/${ctx.customer.id}/product-reviews`)
      .set(auth(ctx.sellerToken));

    expect(res.status).toBe(200);
    expect(res.body.data.reviews.some((r) => r.id === ctx.reviewId)).toBe(true);
    expect(res.body.data.pagination.totalItems).toBeGreaterThanOrEqual(1);
    const listed = res.body.data.reviews.find((r) => r.id === ctx.reviewId);
    expect(listed.seller).toMatchObject({
      id: ctx.seller.id,
      actionUrl: `/store/${ctx.seller.id}`,
    });
  });

  test("7) PATCH review updates rating and averages", async () => {
    const res = await request(app)
      .patch(`/api/customer/review/${ctx.reviewId}`)
      .set(auth(ctx.customerToken))
      .send({ rating: 3, comment: "E2E updated comment" });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: ctx.reviewId,
      rating: 3,
      comment: "E2E updated comment",
    });

    await ctx.product.reload();
    await ctx.seller.reload();
    expect(Number(ctx.product.reviewsCount)).toBe(1);
    expect(Number(ctx.product.averageRating)).toBe(3);
    expect(Number(ctx.seller.ratingCount)).toBe(1);
    expect(Number(ctx.seller.rating)).toBe(3);
  });

  test("8) seller cannot edit customer review", async () => {
    const res = await request(app)
      .patch(`/api/customer/review/${ctx.reviewId}`)
      .set(auth(ctx.sellerToken))
      .send({ rating: 1 });

    expect(res.status).toBe(403);
  });

  test("9) DELETE soft-deletes and recalculates averages", async () => {
    const res = await request(app)
      .delete(`/api/customer/review/${ctx.reviewId}`)
      .set(auth(ctx.customerToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: ctx.reviewId,
      deleted: true,
    });

    const review = await Review.findByPk(ctx.reviewId);
    expect(review.isDeleted).toBe(true);

    await ctx.product.reload();
    await ctx.seller.reload();
    expect(Number(ctx.product.reviewsCount)).toBe(0);
    expect(Number(ctx.product.averageRating)).toBe(0);
    expect(Number(ctx.seller.ratingCount)).toBe(0);
    expect(Number(ctx.seller.rating)).toBe(0);
  });

  test("10) deleted review hidden from lists", async () => {
    const [myRes, productRes, sellerRes] = await Promise.all([
      request(app)
        .get("/api/customer/review/my")
        .set(auth(ctx.customerToken)),
      request(app)
        .get(`/api/review/product/${ctx.product.id}`)
        .set(auth(ctx.customerToken)),
      request(app).get("/api/seller/review").set(auth(ctx.sellerToken)),
    ]);

    expect(myRes.status).toBe(200);
    expect(myRes.body.data.reviews.some((r) => r.id === ctx.reviewId)).toBe(
      false,
    );

    expect(productRes.status).toBe(200);
    expect(productRes.body.data.totalReviews).toBe(0);
    expect(
      productRes.body.data.reviews.some((r) => r.id === ctx.reviewId),
    ).toBe(false);

    expect(sellerRes.status).toBe(200);
    expect(
      sellerRes.body.data.reviews.some((r) => r.id === ctx.reviewId),
    ).toBe(false);
  });

  test("11) can re-review same product after soft delete with renewed window", async () => {
    const res = await request(app)
      .post("/api/customer/review")
      .set(auth(ctx.customerToken))
      .send({
        productId: ctx.product.id,
        orderId: ctx.order.id,
        rating: 4,
        comment: "new review after delete",
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      id: ctx.reviewId,
      rating: 4,
      comment: "new review after delete",
    });
    expect(res.body.data.createdAt).toBeTruthy();

    const review = await Review.findByPk(ctx.reviewId);
    expect(review.isDeleted).toBe(false);
    expect(review.rating).toBe(4);

    await ctx.product.reload();
    await ctx.seller.reload();
    expect(Number(ctx.product.reviewsCount)).toBe(1);
    expect(Number(ctx.product.averageRating)).toBe(4);
    expect(Number(ctx.seller.ratingCount)).toBe(1);
    expect(Number(ctx.seller.rating)).toBe(4);
  });
});
