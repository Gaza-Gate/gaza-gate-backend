/**
 * End-to-end Seller Review routes against real DB.
 * Covers:
 *   GET    /api/seller/review
 *   POST   /api/seller/review/customer
 *   PATCH  /api/seller/review/customer/:id
 *   DELETE /api/seller/review/customer/:id
 *   GET    /api/review/customer/:customerId/seller-reviews
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
const SellerCustomerReview = require("../../models/sellerCustomerReview.model.js");
const USER_ROLES = require("../../constants/user/userRoles.constant.js");
const ORDER_STATUSES = require("../../constants/order/orderStatuses.constant.js");
const PRODUCT_STATUS = require("../../constants/product/productStatus.constant.js");
const PRODUCT_STOCK_TYPES = require("../../constants/product/stockType.constant.js");
const tokenUtil = require("../../utils/security/token.util.js");

const stamp = Date.now();
const VALID_UUID = "11111111-1111-4111-8111-111111111111";

const ctx = {
  customerUser: null,
  sellerUser: null,
  otherSellerUser: null,
  customer: null,
  seller: null,
  otherSeller: null,
  product: null,
  completedOrder: null,
  pendingOrder: null,
  orderItem: null,
  productReviewId: null,
  sellerCustomerReviewId: null,
  customerToken: null,
  sellerToken: null,
  otherSellerToken: null,
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });

const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

async function setReviewCreatedAt(reviewId, date) {
  await sequelize.query(
    `UPDATE seller_customer_review SET created_at = :createdAt WHERE id = :id`,
    {
      replacements: {
        createdAt: date,
        id: reviewId,
      },
    },
  );
}


async function seed() {
  const leftoverUsers = await User.findAll({
    where: {
      email: { [Op.like]: "e2e.seller.review.%@test.local" },
    },
    attributes: ["id"],
  });

  for (const user of leftoverUsers) {
    const customer = await Customer.findOne({ where: { userId: user.id } });
    const seller = await Seller.findOne({ where: { userId: user.id } });

    if (customer) {
      await SellerCustomerReview.destroy({
        where: { customerId: customer.id },
        force: true,
      });
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
      await SellerCustomerReview.destroy({
        where: { sellerId: seller.id },
        force: true,
      });
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
    lastName: "Buyer",
    email: `e2e.seller.review.customer.${stamp}@test.local`,
    isVerified: true,
    status: "active",
    tokenVersion: 0,
  });

  ctx.sellerUser = await User.create({
    activeRoleId: sellerRole.id,
    firstName: "E2E",
    lastName: "Seller",
    email: `e2e.seller.review.seller.${stamp}@test.local`,
    isVerified: true,
    status: "active",
    tokenVersion: 0,
  });

  ctx.otherSellerUser = await User.create({
    activeRoleId: sellerRole.id,
    firstName: "E2E",
    lastName: "OtherSeller",
    email: `e2e.seller.review.other.${stamp}@test.local`,
    isVerified: true,
    status: "active",
    tokenVersion: 0,
  });

  ctx.customer = await Customer.create({ userId: ctx.customerUser.id });
  ctx.seller = await Seller.create({
    userId: ctx.sellerUser.id,
    storeName: `E2E SellerStore ${stamp}`,
    storeDescription: "Temporary store for seller review e2e",
  });
  ctx.otherSeller = await Seller.create({
    userId: ctx.otherSellerUser.id,
    storeName: `E2E OtherStore ${stamp}`,
    storeDescription: "Other seller store",
  });

  ctx.product = await Product.create({
    sellerId: ctx.seller.id,
    categoryId: category.id,
    name: `E2E SellerReview Product ${stamp}`,
    description: "Temporary product",
    price: 40,
    stockType: PRODUCT_STOCK_TYPES.UNLIMITED,
    status: PRODUCT_STATUS.ACTIVE,
    averageRating: 0,
    reviewsCount: 0,
  });

  ctx.completedOrder = await Order.create({
    orderNumber: `E2E-SCR-C-${stamp}`,
    customerId: ctx.customer.id,
    sellerId: ctx.seller.id,
    status: ORDER_STATUSES.COMPLETED,
    paymentMethod: "cash_on_delivery",
    paymentStatus: "paid",
    shippingNeighborhood: "Test",
    shippingStreet: "Test Street",
    subtotal: 40,
    discountAmount: 0,
    shippingFee: 0,
    totalPrice: 40,
    completedAt: new Date(),
  });

  ctx.pendingOrder = await Order.create({
    orderNumber: `E2E-SCR-P-${stamp}`,
    customerId: ctx.customer.id,
    sellerId: ctx.seller.id,
    status: ORDER_STATUSES.PENDING_REVIEW,
    paymentMethod: "cash_on_delivery",
    paymentStatus: "pending",
    shippingNeighborhood: "Test",
    shippingStreet: "Test Street",
    subtotal: 40,
    discountAmount: 0,
    shippingFee: 0,
    totalPrice: 40,
  });

  ctx.orderItem = await OrderItem.create({
    orderId: ctx.completedOrder.id,
    productId: ctx.product.id,
    productName: ctx.product.name,
    unitPrice: 40,
    quantity: 1,
    lineTotal: 40,
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
  ctx.otherSellerToken = tokenUtil.signAccessToken(
    tokenUtil.buildTokenPayload({
      userId: ctx.otherSellerUser.id,
      role: USER_ROLES.SELLER,
      tokenVersion: 0,
    }),
  );
}

async function cleanup() {
  if (ctx.seller?.id) {
    await SellerCustomerReview.destroy({
      where: { sellerId: ctx.seller.id },
      force: true,
    });
  }
  if (ctx.customer?.id) {
    await SellerCustomerReview.destroy({
      where: { customerId: ctx.customer.id },
      force: true,
    });
    await Review.destroy({ where: { customerId: ctx.customer.id }, force: true });
  }
  if (ctx.product?.id) {
    await Review.destroy({ where: { productId: ctx.product.id }, force: true });
  }
  if (ctx.orderItem?.id) {
    await OrderItem.destroy({ where: { id: ctx.orderItem.id }, force: true });
  }
  if (ctx.completedOrder?.id) {
    await Order.destroy({ where: { id: ctx.completedOrder.id }, force: true });
  }
  if (ctx.pendingOrder?.id) {
    await Order.destroy({ where: { id: ctx.pendingOrder.id }, force: true });
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
  if (ctx.otherSeller?.id) {
    await Seller.destroy({ where: { id: ctx.otherSeller.id }, force: true });
  }
  for (const user of [ctx.customerUser, ctx.sellerUser, ctx.otherSellerUser]) {
    if (user?.id) {
      await User.destroy({ where: { id: user.id }, force: true });
    }
  }
}

describe("Seller Review routes E2E", () => {
  jest.setTimeout(90000);

  beforeAll(async () => {
    await sequelize.authenticate();
    await SellerCustomerReview.sync();
    await seed();
  }, 90000);

  afterAll(async () => {
    try {
      await cleanup();
    } finally {
      await sequelize.close();
    }
  }, 90000);

  // ─── GET /api/seller/review (incoming product reviews) ───

  describe("GET /api/seller/review", () => {
    test("requires auth", async () => {
      const res = await request(app).get("/api/seller/review");
      expect(res.status).toBe(401);
    });

    test("rejects customer role", async () => {
      const res = await request(app)
        .get("/api/seller/review")
        .set(auth(ctx.customerToken));
      expect(res.status).toBe(403);
    });

    test("returns empty list when no product reviews yet", async () => {
      const res = await request(app)
        .get("/api/seller/review")
        .set(auth(ctx.sellerToken));

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        totalReviews: 0,
        reviews: [],
      });
      expect(res.body.data.pagination).toBeTruthy();
    });

    test("lists product reviews after customer reviews a product", async () => {
      const createRes = await request(app)
        .post("/api/customer/review")
        .set(auth(ctx.customerToken))
        .send({
          productId: ctx.product.id,
          orderId: ctx.completedOrder.id,
          rating: 5,
          comment: "Great product for seller list",
        });
      expect(createRes.status).toBe(201);
      ctx.productReviewId = createRes.body.data.id;

      const res = await request(app)
        .get("/api/seller/review")
        .set(auth(ctx.sellerToken));

      expect(res.status).toBe(200);
      expect(res.body.data.totalReviews).toBe(1);
      expect(
        res.body.data.reviews.some((r) => r.id === ctx.productReviewId),
      ).toBe(true);
    });

    test("filters by rating query", async () => {
      const match = await request(app)
        .get("/api/seller/review?rating=5")
        .set(auth(ctx.sellerToken));
      expect(match.status).toBe(200);
      expect(match.body.data.reviews.length).toBeGreaterThanOrEqual(1);

      const miss = await request(app)
        .get("/api/seller/review?rating=1")
        .set(auth(ctx.sellerToken));
      expect(miss.status).toBe(200);
      expect(
        miss.body.data.reviews.every((r) => r.rating === 1),
      ).toBe(true);
    });
  });

  // ─── POST /api/seller/review/customer ───

  describe("POST /api/seller/review/customer", () => {
    test("requires auth", async () => {
      const res = await request(app)
        .post("/api/seller/review/customer")
        .send({ orderId: ctx.completedOrder.id, rating: 5 });
      expect(res.status).toBe(401);
    });

    test("rejects customer role", async () => {
      const res = await request(app)
        .post("/api/seller/review/customer")
        .set(auth(ctx.customerToken))
        .send({ orderId: ctx.completedOrder.id, rating: 5 });
      expect(res.status).toBe(403);
    });

    test("validates body (missing rating)", async () => {
      const res = await request(app)
        .post("/api/seller/review/customer")
        .set(auth(ctx.sellerToken))
        .send({ orderId: ctx.completedOrder.id });
      expect(res.status).toBe(400);
    });

    test("validates body (invalid orderId)", async () => {
      const res = await request(app)
        .post("/api/seller/review/customer")
        .set(auth(ctx.sellerToken))
        .send({ orderId: "not-a-uuid", rating: 5 });
      expect(res.status).toBe(400);
    });

    test("rejects non-completed order", async () => {
      const res = await request(app)
        .post("/api/seller/review/customer")
        .set(auth(ctx.sellerToken))
        .send({ orderId: ctx.pendingOrder.id, rating: 4 });
      expect(res.status).toBe(400);
      expect(String(res.body.data?.message || res.body.message || "")).toMatch(
        /completed/i,
      );
    });

    test("rejects order not owned by seller", async () => {
      const res = await request(app)
        .post("/api/seller/review/customer")
        .set(auth(ctx.otherSellerToken))
        .send({ orderId: ctx.completedOrder.id, rating: 3 });
      expect(res.status).toBe(404);
    });

    test("rejects unknown order", async () => {
      const res = await request(app)
        .post("/api/seller/review/customer")
        .set(auth(ctx.sellerToken))
        .send({ orderId: VALID_UUID, rating: 5 });
      expect(res.status).toBe(404);
    });

    test("creates seller→customer review on completed order", async () => {
      const res = await request(app)
        .post("/api/seller/review/customer")
        .set(auth(ctx.sellerToken))
        .send({
          orderId: ctx.completedOrder.id,
          rating: 5,
          comment: "Reliable customer",
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        orderId: ctx.completedOrder.id,
        customerId: ctx.customer.id,
        rating: 5,
        comment: "Reliable customer",
      });
      expect(res.body.data.id).toBeTruthy();
      expect(res.body.data.createdAt).toBeTruthy();
      ctx.sellerCustomerReviewId = res.body.data.id;
    });

    test("rejects duplicate active review for same order", async () => {
      const res = await request(app)
        .post("/api/seller/review/customer")
        .set(auth(ctx.sellerToken))
        .send({
          orderId: ctx.completedOrder.id,
          rating: 4,
          comment: "duplicate",
        });
      expect(res.status).toBe(409);
    });
  });

  // ─── PATCH /api/seller/review/customer/:id ───

  describe("PATCH /api/seller/review/customer/:id", () => {
    test("requires auth", async () => {
      const res = await request(app)
        .patch(`/api/seller/review/customer/${ctx.sellerCustomerReviewId}`)
        .send({ rating: 4 });
      expect(res.status).toBe(401);
    });

    test("rejects customer role", async () => {
      const res = await request(app)
        .patch(`/api/seller/review/customer/${ctx.sellerCustomerReviewId}`)
        .set(auth(ctx.customerToken))
        .send({ rating: 4 });
      expect(res.status).toBe(403);
    });

    test("returns 404 for other seller", async () => {
      const res = await request(app)
        .patch(`/api/seller/review/customer/${ctx.sellerCustomerReviewId}`)
        .set(auth(ctx.otherSellerToken))
        .send({ rating: 2 });
      expect(res.status).toBe(404);
    });

    test("returns 404 for unknown id", async () => {
      const res = await request(app)
        .patch(`/api/seller/review/customer/${VALID_UUID}`)
        .set(auth(ctx.sellerToken))
        .send({ rating: 2 });
      expect(res.status).toBe(404);
    });

    test("rejects empty body", async () => {
      const res = await request(app)
        .patch(`/api/seller/review/customer/${ctx.sellerCustomerReviewId}`)
        .set(auth(ctx.sellerToken))
        .send({});
      expect(res.status).toBe(400);
    });

    test("updates rating and comment within 5 days", async () => {
      const res = await request(app)
        .patch(`/api/seller/review/customer/${ctx.sellerCustomerReviewId}`)
        .set(auth(ctx.sellerToken))
        .send({ rating: 4, comment: "Updated comment" });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        id: ctx.sellerCustomerReviewId,
        rating: 4,
        comment: "Updated comment",
      });
      expect(res.body.data.updatedAt).toBeTruthy();
    });

    test("rejects edit after 5-day window", async () => {
      await setReviewCreatedAt(ctx.sellerCustomerReviewId, daysAgo(6));

      try {
        const res = await request(app)
          .patch(`/api/seller/review/customer/${ctx.sellerCustomerReviewId}`)
          .set(auth(ctx.sellerToken))
          .send({ rating: 3 });

        expect(res.status).toBe(400);
        expect(String(res.body.data?.message || "")).toMatch(/5 days/i);
      } finally {
        await setReviewCreatedAt(ctx.sellerCustomerReviewId, new Date());
      }
    });
  });

  // ─── Seller my outgoing + Customer received lists ───

  describe("GET list endpoints for SellerCustomerReview", () => {
    test("seller GET /customer/my returns reviews I wrote", async () => {
      const res = await request(app)
        .get("/api/seller/review/customer/my")
        .set(auth(ctx.sellerToken));

      expect(res.status).toBe(200);
      expect(res.body.data.totalReviews).toBeGreaterThanOrEqual(1);
      const mine = res.body.data.reviews.find(
        (r) => r.id === ctx.sellerCustomerReviewId,
      );
      expect(mine).toBeTruthy();
      expect(mine.customer).toMatchObject({
        id: ctx.customer.id,
        firstName: "E2E",
        lastName: "Buyer",
      });
      expect(mine.order).toMatchObject({
        id: ctx.completedOrder.id,
      });
      expect(res.body.data.pagination).toBeTruthy();
    });

    test("seller GET /customer/my rejects customer role", async () => {
      const res = await request(app)
        .get("/api/seller/review/customer/my")
        .set(auth(ctx.customerToken));
      expect(res.status).toBe(403);
    });

    test("customer GET /from-sellers returns reviews I received", async () => {
      const res = await request(app)
        .get("/api/customer/review/from-sellers")
        .set(auth(ctx.customerToken));

      expect(res.status).toBe(200);
      expect(res.body.data.totalReviews).toBeGreaterThanOrEqual(1);
      const received = res.body.data.reviews.find(
        (r) => r.id === ctx.sellerCustomerReviewId,
      );
      expect(received).toBeTruthy();
      expect(received.seller).toMatchObject({
        id: ctx.seller.id,
        storeName: expect.any(String),
        actionUrl: `/store/${ctx.seller.id}`,
      });
      expect(res.body.data.pagination).toBeTruthy();
    });

    test("customer GET /from-sellers rejects seller role", async () => {
      const res = await request(app)
        .get("/api/customer/review/from-sellers")
        .set(auth(ctx.sellerToken));
      expect(res.status).toBe(403);
    });
  });

  // ─── GET shared seller-reviews list ───

  describe("GET /api/review/customer/:customerId/seller-reviews", () => {
    test("requires auth", async () => {
      const res = await request(app).get(
        `/api/review/customer/${ctx.customer.id}/seller-reviews`,
      );
      expect(res.status).toBe(401);
    });

    test("lists seller reviews for customer with stats", async () => {
      const res = await request(app)
        .get(`/api/review/customer/${ctx.customer.id}/seller-reviews`)
        .set(auth(ctx.customerToken));

      expect(res.status).toBe(200);
      expect(res.body.data.totalReviews).toBeGreaterThanOrEqual(1);
      expect(res.body.data.averageRating).toBeTruthy();
      expect(
        res.body.data.reviews.some((r) => r.id === ctx.sellerCustomerReviewId),
      ).toBe(true);
      expect(res.body.data.reviews[0].seller).toMatchObject({
        id: ctx.seller.id,
        storeName: expect.any(String),
        actionUrl: `/store/${ctx.seller.id}`,
      });
      expect(res.body.data.reviews[0].product).toMatchObject({
        id: ctx.product.id,
        name: ctx.product.name,
      });
      expect(res.body.data.pagination).toBeTruthy();
    });
  });

  describe("GET /api/profile/customer/:customerId Phase 2", () => {
    test("returns trusted/shopping/sellerReviews preview shape", async () => {
      const res = await request(app)
        .get(`/api/profile/customer/${ctx.customer.id}`)
        .set(auth(ctx.sellerToken));

      expect(res.status).toBe(200);
      expect(res.body.data.customer).toMatchObject({
        id: ctx.customer.id,
        isTrustedBuyer: false,
      });
      expect(res.body.data.stats).toMatchObject({
        completedOrders: expect.any(Number),
        completionRate: expect.any(Number),
        totalReviews: expect.any(Number),
        averageRating: expect.any(Number),
      });
      expect(res.body.data.stats.totalReviews).toBeGreaterThanOrEqual(1);
      expect(res.body.data.shopping.topCategories.length).toBeLessThanOrEqual(
        3,
      );
      expect(res.body.data.shopping.lastOrderAt).toBeTruthy();
      expect(res.body.data.sellerReviews.preview.length).toBeLessThanOrEqual(3);
      expect(
        res.body.data.sellerReviews.preview.some(
          (r) => r.id === ctx.sellerCustomerReviewId,
        ),
      ).toBe(true);
      const preview = res.body.data.sellerReviews.preview.find(
        (r) => r.id === ctx.sellerCustomerReviewId,
      );
      expect(preview.seller).toMatchObject({
        id: ctx.seller.id,
        actionUrl: `/store/${ctx.seller.id}`,
      });
      expect(preview.product).toMatchObject({
        id: ctx.product.id,
        name: ctx.product.name,
      });
      expect(res.body.data.recentReviews).toBeUndefined();
    });
  });

  // ─── DELETE /api/seller/review/customer/:id ───

  describe("DELETE /api/seller/review/customer/:id", () => {
    test("requires auth", async () => {
      const res = await request(app).delete(
        `/api/seller/review/customer/${ctx.sellerCustomerReviewId}`,
      );
      expect(res.status).toBe(401);
    });

    test("rejects customer role", async () => {
      const res = await request(app)
        .delete(`/api/seller/review/customer/${ctx.sellerCustomerReviewId}`)
        .set(auth(ctx.customerToken));
      expect(res.status).toBe(403);
    });

    test("returns 404 for other seller", async () => {
      const res = await request(app)
        .delete(`/api/seller/review/customer/${ctx.sellerCustomerReviewId}`)
        .set(auth(ctx.otherSellerToken));
      expect(res.status).toBe(404);
    });

    test("soft-deletes within 5 days", async () => {
      const res = await request(app)
        .delete(`/api/seller/review/customer/${ctx.sellerCustomerReviewId}`)
        .set(auth(ctx.sellerToken));

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        id: ctx.sellerCustomerReviewId,
        deleted: true,
      });

      const row = await SellerCustomerReview.findByPk(
        ctx.sellerCustomerReviewId,
      );
      expect(row.isDeleted).toBe(true);
    });

    test("hidden from public seller-reviews list after delete", async () => {
      const res = await request(app)
        .get(`/api/review/customer/${ctx.customer.id}/seller-reviews`)
        .set(auth(ctx.sellerToken));

      expect(res.status).toBe(200);
      expect(
        res.body.data.reviews.some((r) => r.id === ctx.sellerCustomerReviewId),
      ).toBe(false);
    });

    test("rejects delete after 5-day window", async () => {
      await SellerCustomerReview.update(
        {
          isDeleted: false,
          rating: 5,
          comment: "aged",
        },
        { where: { id: ctx.sellerCustomerReviewId } },
      );
      await setReviewCreatedAt(ctx.sellerCustomerReviewId, daysAgo(6));

      try {
        const res = await request(app)
          .delete(`/api/seller/review/customer/${ctx.sellerCustomerReviewId}`)
          .set(auth(ctx.sellerToken));

        expect(res.status).toBe(400);
        expect(String(res.body.data?.message || "")).toMatch(/5 days/i);
      } finally {
        await SellerCustomerReview.update(
          { isDeleted: true },
          { where: { id: ctx.sellerCustomerReviewId } },
        );
        await setReviewCreatedAt(ctx.sellerCustomerReviewId, new Date());
      }
    });
  });

  // ─── Revive after soft delete ───

  describe("POST revive after soft delete", () => {
    test("can create again after soft delete and renews createdAt", async () => {
      const before = await SellerCustomerReview.findByPk(
        ctx.sellerCustomerReviewId,
        {
          attributes: [
            "id",
            "isDeleted",
            "rating",
            ["created_at", "createdAt"],
          ],
        },
      );
      expect(before.isDeleted).toBe(true);

      await setReviewCreatedAt(ctx.sellerCustomerReviewId, daysAgo(2));
      const aged = await SellerCustomerReview.findByPk(
        ctx.sellerCustomerReviewId,
        {
          attributes: [["created_at", "createdAt"]],
        },
      );
      const previous = new Date(aged.get("createdAt")).getTime();

      const res = await request(app)
        .post("/api/seller/review/customer")
        .set(auth(ctx.sellerToken))
        .send({
          orderId: ctx.completedOrder.id,
          rating: 5,
          comment: "Re-reviewed after delete",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe(ctx.sellerCustomerReviewId);
      expect(res.body.data).toMatchObject({
        rating: 5,
        comment: "Re-reviewed after delete",
      });

      const revived = await SellerCustomerReview.findByPk(
        ctx.sellerCustomerReviewId,
        {
          attributes: [
            "id",
            "isDeleted",
            "rating",
            ["created_at", "createdAt"],
          ],
        },
      );
      expect(revived.isDeleted).toBe(false);

      const newCreatedAt = new Date(res.body.data.createdAt).getTime();
      expect(Date.now() - newCreatedAt).toBeLessThan(60 * 1000);
      expect(newCreatedAt).toBeGreaterThan(previous + 60 * 1000);
    });

    test("active duplicate still blocked after revive", async () => {
      const res = await request(app)
        .post("/api/seller/review/customer")
        .set(auth(ctx.sellerToken))
        .send({
          orderId: ctx.completedOrder.id,
          rating: 1,
        });
      expect(res.status).toBe(409);
    });
  });
});
