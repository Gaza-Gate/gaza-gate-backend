process.env.MYSQL_URI = "mysql://test:test@127.0.0.1:3306/guest_browse_test";
process.env.JWT_SECRET_KEY = "guest-browse-test-only-secret";

const express = require("express");
const request = require("supertest");
require("../models/associations.js");
const app = express();
app.use("/category", require("../routes/shared/category.route.js"));
app.use("/review", require("../routes/shared/review.route.js"));
app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
const id = "12345678-1234-4123-8123-123456789abc";

test.each([
  `/review/customer/${id}/seller-reviews`,
  `/review/customer/${id}/product-reviews`,
  `/review/seller/${id}/customer-reviews`,
])("%s remains private", async (path) => {
  await request(app).get(path).expect(401);
});

test.each(["", "Bearer invalid"])("category and review routes reject supplied header %j", async (header) => {
  for (const path of ["/category", "/category/all", `/category/${id}`, `/review/product/${id}`, `/review/seller/${id}/product-reviews`]) {
    await request(app).get(path).set("Authorization", header).expect(401);
  }
});
