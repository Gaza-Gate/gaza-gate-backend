const {
  isValidStoreSlug,
  normalizeStoreSlug,
  suggestStoreSlug,
  transliterateArabic,
  withSlugSuffix,
} = require("../utils/navigation/storeSlug.util.js");
const { buildSellerStoreActionUrl } = require("../utils/navigation/sellerStoreLink.util.js");
const { buildStoreShareUrl } = require("../utils/navigation/shareLink.util.js");
const renderAppShellWithMeta = require("../utils/http/renderAppShellWithMeta.util.js");

describe("store slug suggestions", () => {
  test.each([
    ["gift store", "gift-store"],
    ["Feras Store!!", "feras-store"],
    ["مخبوزات المدينة", "mkhbozat-almdina"],
    ["وردة يافا", "wrda-yafa"],
    ["Sultan Nuts | سلطان المكسرات", "sultan-nuts-sltan-almksrat"],
  ])("%j → %j", (name, slug) => {
    expect(suggestStoreSlug(name)).toBe(slug);
    expect(isValidStoreSlug(slug)).toBe(true);
  });

  test("strips Arabic diacritics and tatweel", () => {
    expect(transliterateArabic("مَـكْتَبَة")).toBe(transliterateArabic("مكتبة"));
  });

  test("short, empty and reserved names still give a valid slug", () => {
    expect(suggestStoreSlug("ab")).toBe("store-ab");
    expect(suggestStoreSlug("  --  ")).toBe("store-shop");
    expect(suggestStoreSlug("Admin")).toBe("admin-shop");
    for (const name of ["ab", "  --  ", "Admin", "x".repeat(200)]) {
      expect(isValidStoreSlug(suggestStoreSlug(name))).toBe(true);
    }
  });

  test("duplicate suffixes keep the 40-char limit", () => {
    expect(withSlugSuffix("hala-beauty", 1)).toBe("hala-beauty");
    expect(withSlugSuffix("hala-beauty", 2)).toBe("hala-beauty-2");
    expect(withSlugSuffix("a".repeat(40), 12)).toHaveLength(40);
  });
});

describe("store slug rules", () => {
  test.each(["gift-store", "abc", "store-2", "a".repeat(40)])("%j is valid", (slug) => {
    expect(isValidStoreSlug(slug)).toBe(true);
  });

  test.each([
    "ab", "a".repeat(41), "Gift-Store", "-gift", "gift-", "gift--store", "gift_store",
    "متجر", "admin", "login", "gazagate", "93f24a6a-e402-45e3-a596-1b8ab540ed92",
  ])("%j is rejected", (slug) => {
    expect(isValidStoreSlug(slug)).toBe(false);
  });

  test("seller input is normalized before checking", () => {
    expect(normalizeStoreSlug("  Hala Beauty  ")).toBe("hala-beauty");
  });
});

describe("store links", () => {
  beforeEach(() => {
    process.env.FRONTEND_BASE_URL = "https://gazagate.store";
  });

  test("slug links when the store has one, id links otherwise", () => {
    expect(buildSellerStoreActionUrl({ id: "seller-id", slug: "gift-store" })).toBe("/store/gift-store");
    expect(buildSellerStoreActionUrl({ id: "seller-id", slug: null })).toBe("/customer/store/seller-id");
    expect(buildSellerStoreActionUrl("seller-id")).toBe("/customer/store/seller-id");
    expect(buildSellerStoreActionUrl("seller-id", "gift-store")).toBe("/store/gift-store");
    expect(buildSellerStoreActionUrl(null)).toBeNull();
  });

  test("share URL uses the clean slug link", () => {
    expect(buildStoreShareUrl({ id: "seller-id", slug: "gift-store" })).toBe("https://gazagate.store/store/gift-store");
  });
});

describe("store page with link-preview tags", () => {
  const shell = `<!DOCTYPE html><html><head><title>بوابة غزة</title><meta name="description" content="old" /></head><body><div id="root"></div><script src="/assets/index.js"></script></body></html>`;
  const metadata = {
    title: 'gift <store> | Gaza Gate',
    description: 'هدايا "مخصصة" · ⭐ 5.0',
    image: "https://cdn.example/a.jpg",
    url: "https://gazagate.store/store/gift-store",
    type: "website",
    siteName: "Gaza Gate",
  };

  beforeEach(() => {
    renderAppShellWithMeta.resetAppShellCache();
    process.env.FRONTEND_BASE_URL = "https://gazagate.store";
    global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => shell });
  });

  test("injects escaped tags into the real app page and keeps the app script", async () => {
    const html = await renderAppShellWithMeta(metadata);
    expect(global.fetch).toHaveBeenCalledWith("https://gazagate.store/", expect.any(Object));
    expect(html).toContain('<script src="/assets/index.js"></script>');
    expect(html).toContain("<title>gift &lt;store&gt; | Gaza Gate</title>");
    expect(html).toContain('<meta property="og:description" content="هدايا &quot;مخصصة&quot; · ⭐ 5.0" />');
    expect(html).toContain('<meta property="og:image" content="https://cdn.example/a.jpg" />');
    expect(html).not.toContain('content="old"');
    expect(html).not.toContain("<store>");
  });

  test("unknown store gets the plain app page", async () => {
    expect(await renderAppShellWithMeta(null)).toBe(shell);
  });

  test("frontend unreachable still returns a page with the card", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("down"));
    jest.spyOn(console, "warn").mockImplementation(() => {});
    const html = await renderAppShellWithMeta(metadata);
    expect(html).toContain('<meta property="og:url" content="https://gazagate.store/store/gift-store" />');
  });
});
