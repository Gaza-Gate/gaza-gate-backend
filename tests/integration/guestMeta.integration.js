const mysql = require("mysql2/promise");
const { randomUUID } = require("crypto");
const request = require("supertest");
const jwt = require("jsonwebtoken");

// Only a newly created local schema is ever synchronized or dropped.
const serverUrl = new URL(process.env.TEST_MYSQL_SERVER_URL || "mysql://root@127.0.0.1:33317");
if (!["127.0.0.1", "localhost", "[::1]"].includes(serverUrl.hostname)) {
  throw new Error("Integration tests require a local TEST_MYSQL_SERVER_URL.");
}
serverUrl.pathname = "/";
serverUrl.search = "";
serverUrl.hash = "";
const databaseName = `gaza_api_test_${randomUUID().replaceAll("-", "")}`;
const databaseUrl = new URL(serverUrl);
databaseUrl.pathname = `/${databaseName}`;
process.env.MYSQL_URI = databaseUrl.href;
process.env.JWT_SECRET_KEY = "integration-test-only-secret";
process.env.OPENAI_API_KEY = "test-only";
process.env.FRONTEND_BASE_URL = "https://front.example/app/";
process.env.SITE_IDENTITY_IMAGE_URL = "https://cdn.example/fallback.jpg";
process.env.SCRIPT_URL = "";
process.env.STYLE_URL = "";

const app = require("../../app.js");
const {
  Role, User, Customer, Seller, Category, Product, ProductImage, Order, Review, Wishlist,
} = require("../../models/associations.js");
const { sequelize } = require("../../config/db.config.js");
let adminConnection;
let schemaCreated = false;
let fixtures;

beforeAll(async () => {
  adminConnection = await mysql.createConnection(serverUrl.href);
  await adminConnection.query(`CREATE DATABASE \`${databaseName}\``);
  schemaCreated = true;
  await sequelize.sync();
  const role = await Role.create({ name: "customer" });
  const createUser = (name, status = "active") => User.create({
    activeRoleId: role.id, firstName: name, lastName: "Tester",
    email: `${name.toLowerCase()}@example.test`, status,
  });
  const sellerUser = await createUser("Seller");
  const bannedUser = await createUser("Banned", "banned");
  const customerUser = await createUser("Buyer");
  const customer = await Customer.create({ userId: customerUser.id });
  const seller = await Seller.create({ userId: sellerUser.id, storeName: "Visible store", rating: 3, ratingCount: 4 });
  const bannedSeller = await Seller.create({ userId: bannedUser.id, storeName: "Banned store" });
  const emptySeller = await Seller.create({ userId: (await createUser("Empty")).id, storeName: "Empty store" });
  const category = await Category.create({ name: "Catalog", description: "Public category" });
  const inactiveCategory = await Category.create({ name: "Inactive", isActive: false });
  await Category.bulkCreate(Array.from({ length: 13 }, (_, i) => ({ name: `Page ${String(i).padStart(2, "0")}` })));
  const createProduct = (name, overrides = {}) => Product.create({
    name, sellerId: seller.id, categoryId: category.id, price: 10,
    status: "active", averageRating: 5, reviewsCount: 1, ...overrides,
  });
  const visible = await createProduct('</title><script>alert(1)</script>', { description: '\"><script>alert(2)</script>' });
  const second = await createProduct("Second visible", { averageRating: 3 });
  const hidden = await createProduct("Hidden product", { status: "hidden" });
  const deleted = await createProduct("Deleted product", { isDeleted: true });
  const banned = await createProduct("Banned seller product", { sellerId: bannedSeller.id });
  await ProductImage.bulkCreate([
    { productId: visible.id, imageUrl: "https://cdn.example/secondary.jpg", publicId: "secondary", position: 0 },
    { productId: visible.id, imageUrl: "https://cdn.example/primary.jpg", publicId: "primary", isPrimary: true, position: 9 },
  ]);
  const order = await Order.create({
    orderNumber: "test-order", customerId: customer.id, sellerId: seller.id,
    shippingNeighborhood: "Test area", shippingStreet: "Test street",
  });
  for (const [product, rating] of [[visible, 5], [second, 3], [hidden, 1], [deleted, 2], [banned, 1]]) {
    await Review.create({
      productId: product.id, customerId: customer.id, sellerId: product.sellerId,
      orderId: order.id, rating, comment: `Review for ${product.name}`,
    });
  }
  await Wishlist.create({ customerId: customer.id, productId: visible.id });
  const token = jwt.sign({ userId: customerUser.id, role: "customer", tokenVersion: 0 }, process.env.JWT_SECRET_KEY);
  fixtures = { seller, bannedSeller, emptySeller, category, inactiveCategory, visible, second, hidden, deleted, banned, token };
}, 60000);

afterAll(async () => {
  await sequelize.close();
  if (adminConnection) {
    try {
      if (schemaCreated) await adminConnection.query(`DROP DATABASE \`${databaseName}\``);
    } finally {
      await adminConnection.end();
    }
  }
});

test("guest categories count only active products of active sellers", async () => {
  const response = await request(app).get("/api/category?search=Catalog&active=false").expect(200);
  expect(response.body.data.categories).toEqual([
    expect.objectContaining({ id: fixtures.category.id, productCount: 2 }),
  ]);
  expect(response.body.data.pagination.totalItems).toBe(1);
  await request(app).get(`/api/category/${fixtures.inactiveCategory.id}`).expect(404);
  const detail = await request(app).get(`/api/category/${fixtures.category.id}`).expect(200);
  expect(detail.body.data.category.name).toBe("Catalog");
  const all = await request(app).get("/api/category/all").expect(200);
  expect(all.body.data.categories.some(category => category.id === fixtures.inactiveCategory.id)).toBe(false);
});

test("guest category pagination retains empty categories and accurate totals", async () => {
  const first = await request(app).get("/api/category?search=Page").expect(200);
  const second = await request(app).get("/api/category?search=Page&page=2").expect(200);
  expect(first.body.data.categories).toHaveLength(12);
  expect(second.body.data.categories).toHaveLength(1);
  expect(first.body.data.pagination).toMatchObject({ totalItems: 13, totalPages: 2, hasNextPage: true });
  expect(second.body.data.categories[0].productCount).toBe(0);
});

test("authenticated categories preserve inactive visibility", async () => {
  const response = await request(app).get(`/api/category/${fixtures.inactiveCategory.id}`)
    .set("Authorization", `Bearer ${fixtures.token}`).expect(200);
  expect(response.body.data.category.isActive).toBe(false);
});

test.each(["hidden", "deleted", "banned"])("guest product reviews hide %s products", async (key) => {
  await request(app).get(`/api/review/product/${fixtures[key].id}`).expect(404);
});

test("guest product reviews return visible content", async () => {
  const response = await request(app).get(`/api/review/product/${fixtures.visible.id}`).expect(200);
  expect(response.body.data.reviews).toHaveLength(1);
  expect(response.body.data.reviews[0].rating).toBe(5);
});

test("guest seller reviews filter rows, totals, and rating distribution consistently", async () => {
  const response = await request(app).get(`/api/review/seller/${fixtures.seller.id}/product-reviews`).expect(200);
  expect(response.body.data.reviews.map(review => review.product.id).sort())
    .toEqual([fixtures.visible.id, fixtures.second.id].sort());
  expect(response.body.data).toMatchObject({
    averageRating: 4, totalReviews: 2, distribution: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 1 },
    pagination: { totalItems: 2 },
  });
  const filtered = await request(app).get(`/api/review/seller/${fixtures.seller.id}/product-reviews?rating=5`).expect(200);
  expect(filtered.body.data.reviews).toHaveLength(1);
  expect(filtered.body.data.pagination.totalItems).toBe(1);
  expect(filtered.body.data.totalReviews).toBe(2);
});

test("guest seller reviews reject banned sellers and handle empty stores", async () => {
  await request(app).get(`/api/review/seller/${fixtures.bannedSeller.id}/product-reviews`).expect(404);
  const response = await request(app).get(`/api/review/seller/${fixtures.emptySeller.id}/product-reviews`).expect(200);
  expect(response.body.data).toMatchObject({ averageRating: 0, totalReviews: 0, reviews: [], pagination: { totalItems: 0 } });
});

test("authenticated reviews retain hidden product access", async () => {
  await request(app).get(`/api/review/product/${fixtures.hidden.id}`)
    .set("Authorization", `Bearer ${fixtures.token}`).expect(200);
  const response = await request(app).get(`/api/review/seller/${fixtures.seller.id}/product-reviews`)
    .set("Authorization", `Bearer ${fixtures.token}`).expect(200);
  expect(response.body.data.reviews).toHaveLength(4);
});

test("HTML and legacy JSON Meta share the primary image and canonical URL", async () => {
  const json = await request(app).get(`/api/meta/product/${fixtures.visible.id}`).expect(200);
  expect(json.body.data).toMatchObject({
    image: "https://cdn.example/primary.jpg", url: `https://front.example/app/product/${fixtures.visible.id}`,
  });
  const html = await request(app).get(`/api/product/${fixtures.visible.id}/meta`).expect(200);
  expect(html.headers["content-type"]).toContain("text/html");
  expect(html.text).toContain('property="og:image" content="https://cdn.example/primary.jpg"');
  expect(html.text).toContain('name="twitter:image" content="https://cdn.example/primary.jpg"');
  expect(html.text).not.toMatch(/<script>|undefined/);
  expect(html.text).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  expect(html.text).toContain("&quot;&gt;&lt;script&gt;alert(2)&lt;/script&gt;");
});

test("products without a primary image use the configured fallback", async () => {
  const response = await request(app).get(`/api/product/${fixtures.second.id}/meta`).expect(200);
  expect(response.text).toContain('property="og:image" content="https://cdn.example/fallback.jpg"');
});

test.each(["hidden", "deleted", "banned"])("both Meta formats hide %s products", async (key) => {
  await request(app).get(`/api/product/${fixtures[key].id}/meta`).expect(404);
  await request(app).get(`/api/meta/product/${fixtures[key].id}`).expect(404);
});

test("legacy store metadata remains available only for active sellers", async () => {
  const response = await request(app).get(`/api/meta/store/${fixtures.seller.id}`).expect(200);
  expect(response.body.data).toMatchObject({ title: "Visible store", type: "profile" });
  await request(app).get(`/api/meta/store/${fixtures.bannedSeller.id}`).expect(404);
});

test.each(["/api/product/invalid/meta", "/api/meta/product/invalid", "/api/meta/store/invalid"])("Meta rejects malformed identifiers at %s", async (path) => {
  await request(app).get(path).expect(400);
});

test("guest product and store browsing rejects supplied invalid credentials and protects writes", async () => {
  for (const path of [
    "/api/product/public", `/api/product/public/${fixtures.visible.id}`,
    `/api/product/${fixtures.visible.id}/meta`, `/api/store/${fixtures.seller.id}`,
    `/api/store/${fixtures.seller.id}/products`,
  ]) {
    await request(app).get(path).set("Authorization", "Bearer invalid").expect(401);
  }
  await request(app).post("/api/product").expect(401);
});


test("public product browsing hides banned sellers and keeps wishlist state private", async () => {
  const listing = await request(app).get("/api/product/public").expect(200);
  expect(listing.body.data.products.map(product => product.id).sort())
    .toEqual([fixtures.visible.id, fixtures.second.id].sort());
  const guest = await request(app).get(`/api/product/public/${fixtures.visible.id}`).expect(200);
  expect(guest.body.data.product.isWishlisted).toBe(false);
  const customer = await request(app).get(`/api/product/public/${fixtures.visible.id}`)
    .set("Authorization", `Bearer ${fixtures.token}`).expect(200);
  expect(customer.body.data.product.isWishlisted).toBe(true);
  await request(app).get(`/api/product/public/${fixtures.banned.id}`).expect(404);
});

test("guest store routes and compatibility alias return only active store products", async () => {
  for (const prefix of ["/api/store", "/api/customer/store"]) {
    await request(app).get(`${prefix}/${fixtures.seller.id}`).expect(200);
    const response = await request(app).get(`${prefix}/${fixtures.seller.id}/products`).expect(200);
    expect(response.body.data.products.map(product => product.id).sort())
      .toEqual([fixtures.visible.id, fixtures.second.id].sort());
    await request(app).get(`${prefix}/${fixtures.bannedSeller.id}`).expect(404);
  }
});
