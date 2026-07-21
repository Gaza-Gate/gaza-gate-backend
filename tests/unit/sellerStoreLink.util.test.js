const {
  buildSellerStoreActionUrl,
  mapSellerSummary,
} = require("../../utils/navigation/sellerStoreLink.util.js");

describe("sellerStoreLink.util", () => {
  const sellerId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

  describe("buildSellerStoreActionUrl", () => {
    test("builds /store/:sellerId", () => {
      expect(buildSellerStoreActionUrl(sellerId)).toBe(`/store/${sellerId}`);
    });

    test("returns null when sellerId is missing", () => {
      expect(buildSellerStoreActionUrl(null)).toBeNull();
      expect(buildSellerStoreActionUrl(undefined)).toBeNull();
      expect(buildSellerStoreActionUrl("")).toBeNull();
    });
  });

  describe("mapSellerSummary", () => {
    test("maps seller with actionUrl and null avatar by default", () => {
      expect(
        mapSellerSummary({ id: sellerId, storeName: "متجر الأمانة" }),
      ).toEqual({
        id: sellerId,
        storeName: "متجر الأمانة",
        avatar: null,
        actionUrl: `/store/${sellerId}`,
      });
    });

    test("uses user avatar when provided", () => {
      expect(
        mapSellerSummary(
          { id: sellerId, storeName: "Store" },
          { avatar: "https://cdn.example/a.png" },
        ),
      ).toMatchObject({
        avatar: "https://cdn.example/a.png",
        actionUrl: `/store/${sellerId}`,
      });
    });

    test("reads avatar from nested seller.user when second arg omitted", () => {
      expect(
        mapSellerSummary({
          id: sellerId,
          storeName: "Store",
          user: { avatar: "https://cdn.example/nested.png" },
        }),
      ).toMatchObject({
        avatar: "https://cdn.example/nested.png",
        actionUrl: `/store/${sellerId}`,
      });
    });

    test("explicit user arg wins over nested seller.user", () => {
      expect(
        mapSellerSummary(
          {
            id: sellerId,
            storeName: "Store",
            user: { avatar: "https://cdn.example/nested.png" },
          },
          { avatar: "https://cdn.example/explicit.png" },
        ),
      ).toMatchObject({
        avatar: "https://cdn.example/explicit.png",
      });
    });

    test("returns null when seller id is missing", () => {
      expect(mapSellerSummary(null)).toBeNull();
      expect(mapSellerSummary({})).toBeNull();
    });

    test("product/conversation/review surfaces share /store/<uuid> shape", () => {
      const summary = mapSellerSummary({
        id: sellerId,
        storeName: "Store",
      });
      expect(summary.actionUrl).toMatch(
        /^\/store\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(summary.actionUrl).toBe(buildSellerStoreActionUrl(sellerId));
    });
  });
});
