const {
  createReviewValidator,
  updateReviewValidator,
  reviewIdParamValidator,
  getProductReviewsValidator,
} = require("../../middlewares/validators/review.validator.js");
const { validationResult } = require("express-validator");

const runValidators = async (validators, req) => {
  req.body = req.body || {};
  req.params = req.params || {};
  req.query = req.query || {};
  for (const validator of validators) {
    await validator.run(req);
  }
  return validationResult(req);
};

describe("review.validator", () => {
  test("createReviewValidator rejects missing rating", async () => {
    const result = await runValidators(createReviewValidator, {
      body: {
        productId: "11111111-1111-4111-8111-111111111111",
        orderId: "22222222-2222-4222-8222-222222222222",
      },
    });
    expect(result.isEmpty()).toBe(false);
  });

  test("createReviewValidator accepts valid payload", async () => {
    const result = await runValidators(createReviewValidator, {
      body: {
        productId: "11111111-1111-4111-8111-111111111111",
        orderId: "22222222-2222-4222-8222-222222222222",
        rating: 5,
        comment: "great",
      },
    });
    expect(result.isEmpty()).toBe(true);
  });

  test("updateReviewValidator rejects invalid review id", async () => {
    const result = await runValidators(updateReviewValidator, {
      params: { id: "not-a-uuid" },
      body: { rating: 4 },
    });
    expect(result.isEmpty()).toBe(false);
  });

  test("updateReviewValidator accepts optional rating", async () => {
    const result = await runValidators(updateReviewValidator, {
      params: { id: "11111111-1111-4111-8111-111111111111" },
      body: { comment: "updated" },
    });
    expect(result.isEmpty()).toBe(true);
  });

  test("reviewIdParamValidator rejects bad id", async () => {
    const result = await runValidators(reviewIdParamValidator, {
      params: { id: "abc" },
    });
    expect(result.isEmpty()).toBe(false);
  });

  test("getProductReviewsValidator rejects bad productId", async () => {
    const result = await runValidators(getProductReviewsValidator, {
      params: { productId: "bad" },
      query: {},
    });
    expect(result.isEmpty()).toBe(false);
  });

  test("getProductReviewsValidator accepts productId and page", async () => {
    const result = await runValidators(getProductReviewsValidator, {
      params: { productId: "11111111-1111-4111-8111-111111111111" },
      query: { page: "2", rating: "5" },
    });
    expect(result.isEmpty()).toBe(true);
  });
});
