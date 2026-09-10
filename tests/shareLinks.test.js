const {
  buildProductShareUrl, buildStoreShareUrl, buildSharePayload,
} = require("../utils/navigation/shareLink.util.js");
const renderMetaDocument = require("../utils/http/renderMetaDocument.util.js");

beforeEach(() => {
  process.env.FRONTEND_BASE_URL = "https://front.example/app/";
  delete process.env.SCRIPT_URL;
  delete process.env.STYLE_URL;
});

test("share links preserve frontend prefixes and encode social targets", () => {
  const url = buildProductShareUrl("product-id");
  expect(url).toBe("https://front.example/app/product/product-id");
  expect(buildStoreShareUrl("seller-id")).toBe("https://front.example/app/store/seller-id");
  const payload = buildSharePayload(url, "Fish & chips");
  expect(new URL(payload.targets.whatsapp).searchParams.get("text")).toBe(`Fish & chips ${url}`);
  expect(new URL(payload.targets.facebook).searchParams.get("u")).toBe(url);
  expect(new URL(payload.targets.telegram).searchParams.get("text")).toBe("Fish & chips");
  expect(new URL(payload.targets.twitter).searchParams.get("url")).toBe(url);
});

test.each(["", "invalid", "javascript:alert(1)"])("invalid frontend base %j fails explicitly", (base) => {
  process.env.FRONTEND_BASE_URL = base;
  expect(() => buildProductShareUrl("product-id")).toThrow("FRONTEND_BASE_URL");
});

const metadata = {
  title: '</title><script>alert(1)</script>',
  description: '\"><script>alert(2)</script> & details',
  image: 'https://cdn.example/image.jpg?name="special"&size=large',
  url: "https://front.example/app/product/product-id",
  type: "product",
  siteName: "Gaza Gate",
};

test("Meta HTML escapes stored product text and image attributes", () => {
  const html = renderMetaDocument(metadata);
  expect(html).not.toContain("<script>");
  expect(html).toContain("&lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt;");
  expect(html).toContain("&quot;&gt;&lt;script&gt;alert(2)&lt;/script&gt; &amp; details");
  expect(html).toContain("name=&quot;special&quot;&amp;size=large");
  expect(html).toContain(`href="${metadata.url}"`);
});

test("missing images and frontend assets produce a usable page without undefined URLs", () => {
  const html = renderMetaDocument({ ...metadata, image: null });
  expect(html).not.toMatch(/undefined|og:image|twitter:image|<script|stylesheet/);
  expect(html).toContain('content="summary"');
  expect(html).toContain(`<a href="${metadata.url}">`);
});

test("configured frontend assets are resolved and escaped", () => {
  process.env.SCRIPT_URL = "/assets/main.js?x=1&y=2";
  process.env.STYLE_URL = "https://cdn.example/style.css";
  const html = renderMetaDocument(metadata);
  expect(html).toContain('src="https://front.example/assets/main.js?x=1&amp;y=2"');
  expect(html).toContain('href="https://cdn.example/style.css"');
});

test.each(["javascript:alert(1)", "data:text/javascript,alert(1)", "https://["])("unsafe asset URL %j fails explicitly", (url) => {
  process.env.SCRIPT_URL = url;
  expect(() => renderMetaDocument(metadata)).toThrow();
});
