require("dotenv").config();
const request = require("supertest");
const app = require("../../app.js");

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

describe("Review routes (auth required)", () => {
  describe("shared /api/review", () => {
    test("GET /product/:productId requires auth", async () => {
      const res = await request(app).get(
        `/api/review/product/${VALID_UUID}`,
      );
      expect(res.status).toBe(401);
    });

    test("GET /customer/:customerId/product-reviews requires auth", async () => {
      const res = await request(app).get(
        `/api/review/customer/${VALID_UUID}/product-reviews`,
      );
      expect(res.status).toBe(401);
    });

    test("GET /customer/:customerId/seller-reviews requires auth", async () => {
      const res = await request(app).get(
        `/api/review/customer/${VALID_UUID}/seller-reviews`,
      );
      expect(res.status).toBe(401);
    });

    test("GET /seller/:sellerId/product-reviews requires auth", async () => {
      const res = await request(app).get(
        `/api/review/seller/${VALID_UUID}/product-reviews`,
      );
      expect(res.status).toBe(401);
    });

    test("GET /seller/:sellerId/customer-reviews requires auth", async () => {
      const res = await request(app).get(
        `/api/review/seller/${VALID_UUID}/customer-reviews`,
      );
      expect(res.status).toBe(401);
    });
  });

  describe("customer /api/customer/review", () => {
    test("GET /my requires auth", async () => {
      const res = await request(app).get("/api/customer/review/my");
      expect(res.status).toBe(401);
    });

    test("GET /from-sellers requires auth", async () => {
      const res = await request(app).get("/api/customer/review/from-sellers");
      expect(res.status).toBe(401);
    });

    test("PATCH /:id requires auth", async () => {
      const res = await request(app)
        .patch(`/api/customer/review/${VALID_UUID}`)
        .send({ rating: 4 });
      expect(res.status).toBe(401);
    });

    test("DELETE /:id requires auth", async () => {
      const res = await request(app).delete(
        `/api/customer/review/${VALID_UUID}`,
      );
      expect(res.status).toBe(401);
    });

    test("POST / requires auth", async () => {
      const res = await request(app)
        .post("/api/customer/review")
        .send({
          productId: VALID_UUID,
          orderId: VALID_UUID,
          rating: 5,
        });
      expect(res.status).toBe(401);
    });
  });

  describe("seller /api/seller/review", () => {
    test("GET / requires auth", async () => {
      const res = await request(app).get("/api/seller/review");
      expect(res.status).toBe(401);
    });

    test("GET /customer/my requires auth", async () => {
      const res = await request(app).get("/api/seller/review/customer/my");
      expect(res.status).toBe(401);
    });

    test("POST /customer requires auth", async () => {
      const res = await request(app)
        .post("/api/seller/review/customer")
        .send({ orderId: VALID_UUID, rating: 5 });
      expect(res.status).toBe(401);
    });

    test("PATCH /customer/:id requires auth", async () => {
      const res = await request(app)
        .patch(`/api/seller/review/customer/${VALID_UUID}`)
        .send({ rating: 4 });
      expect(res.status).toBe(401);
    });

    test("DELETE /customer/:id requires auth", async () => {
      const res = await request(app).delete(
        `/api/seller/review/customer/${VALID_UUID}`,
      );
      expect(res.status).toBe(401);
    });
  });

  describe("profile public customer", () => {
    test("GET /api/profile/customer/:customerId requires auth", async () => {
      const res = await request(app).get(
        `/api/profile/customer/${VALID_UUID}`,
      );
      expect(res.status).toBe(401);
    });
  });
});

describe("Review modules load", () => {
  test("customer review controller exports expected handlers", () => {
    const controller = require("../../controllers/customer/review.controller.js");
    expect(typeof controller.createReview).toBe("function");
    expect(typeof controller.getMyReviews).toBe("function");
    expect(typeof controller.getMyReceivedSellerReviews).toBe("function");
    expect(typeof controller.updateReview).toBe("function");
    expect(typeof controller.deleteReview).toBe("function");
  });

  test("shared review controller exports shared list handlers", () => {
    const controller = require("../../controllers/shared/review.controller.js");
    expect(typeof controller.getProductReviews).toBe("function");
    expect(typeof controller.getCustomerSellerReviews).toBe("function");
    expect(typeof controller.getCustomerProductReviews).toBe("function");
    expect(typeof controller.getSellerProductReviews).toBe("function");
    expect(typeof controller.getSellerCustomerReviews).toBe("function");
  });

  test("seller review controller exports expected handlers", () => {
    const controller = require("../../controllers/seller/review.controller.js");
    expect(typeof controller.getSellerReviews).toBe("function");
    expect(typeof controller.getMySellerCustomerReviews).toBe("function");
    expect(typeof controller.createSellerCustomerReview).toBe("function");
    expect(typeof controller.updateSellerCustomerReview).toBe("function");
    expect(typeof controller.deleteSellerCustomerReview).toBe("function");
    expect(controller.createReview).toBeUndefined();
  });

  test("review service exports all public functions", () => {
    const service = require("../../services/review/review.service.js");
    expect(typeof service.createReview).toBe("function");
    expect(typeof service.getSellerReviews).toBe("function");
    expect(typeof service.getSellerProductReviewsBySellerId).toBe("function");
    expect(typeof service.getProductReviews).toBe("function");
    expect(typeof service.getMyReviews).toBe("function");
    expect(typeof service.updateReview).toBe("function");
    expect(typeof service.deleteReview).toBe("function");
  });

  test("validators export new review validators", () => {
    const validators = require("../../middlewares/validators/review.validator.js");
    expect(Array.isArray(validators.createReviewValidator)).toBe(true);
    expect(Array.isArray(validators.updateReviewValidator)).toBe(true);
    expect(Array.isArray(validators.reviewIdParamValidator)).toBe(true);
    expect(Array.isArray(validators.getMyReviewsValidator)).toBe(true);
    expect(Array.isArray(validators.getProductReviewsValidator)).toBe(true);
  });

  test("seller customer review service exports CRUD functions", () => {
    const service = require("../../services/review/sellerCustomerReview.service.js");
    expect(typeof service.createSellerCustomerReview).toBe("function");
    expect(typeof service.updateSellerCustomerReview).toBe("function");
    expect(typeof service.deleteSellerCustomerReview).toBe("function");
    expect(typeof service.getCustomerSellerReviews).toBe("function");
    expect(typeof service.getSellerCustomerReviewsBySellerId).toBe("function");
    expect(typeof service.getMySellerCustomerReviews).toBe("function");
    expect(typeof service.getMyReceivedSellerReviews).toBe("function");
  });

  test("seller customer review validators export expected arrays", () => {
    const validators = require("../../middlewares/validators/sellerCustomerReview.validator.js");
    expect(Array.isArray(validators.createSellerCustomerReviewValidator)).toBe(
      true,
    );
    expect(Array.isArray(validators.updateSellerCustomerReviewValidator)).toBe(
      true,
    );
    expect(Array.isArray(validators.sellerCustomerReviewIdParamValidator)).toBe(
      true,
    );
    expect(Array.isArray(validators.getCustomerSellerReviewsValidator)).toBe(
      true,
    );
    expect(Array.isArray(validators.getMySellerCustomerReviewsValidator)).toBe(
      true,
    );
  });
});
