process.env.MYSQL_URI = "mysql://test:test@127.0.0.1:3306/guest_browse_test";
process.env.JWT_SECRET_KEY = "guest-browse-test-only-secret";

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { User } = require("../models/associations.js");
const optionalAuth = require("../middlewares/auth/optionalAuthenticate.middleware.js");
const requiredAuth = require("../middlewares/auth/verifyToken.middleware.js");

const app = express();
app.get("/optional", optionalAuth, (req, res) => res.json(req.user || { visitor: true }));
app.post("/locked", requiredAuth, (req, res) => res.sendStatus(204));
app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));

afterEach(() => jest.restoreAllMocks());

test("missing authorization allows visitors but keeps writes locked", async () => {
  const response = await request(app).get("/optional").expect(200);
  expect(response.body).toEqual({ visitor: true });
  await request(app).post("/locked").expect(401);
});

test.each(["", "Basic invalid", "Bearer invalid", "Bearer "])(
  "supplied malformed authorization %j is rejected",
  async (header) => {
    await request(app).get("/optional").set("Authorization", header).expect(401);
  },
);

test.each(["customer", "seller", "admin"])("valid %s identity survives optional auth", async (role) => {
  const user = User.build({ id: "test-user", status: "active", tokenVersion: 2 });
  jest.spyOn(User, "findByPk").mockResolvedValue(user);
  const accessToken = jwt.sign({ userId: user.id, role, tokenVersion: 2 }, process.env.JWT_SECRET_KEY);
  const response = await request(app).get("/optional").set("Authorization", `Bearer ${accessToken}`).expect(200);
  expect(response.body).toEqual({ id: user.id, role, status: "active" });
});

test.each([
  ["banned", 2, 403],
  ["active", 3, 401],
])("account status %s and version %s rejects stale access", async (status, tokenVersion, expectedStatus) => {
  jest.spyOn(User, "findByPk").mockResolvedValue(User.build({ id: "test-user", status, tokenVersion }));
  const accessToken = jwt.sign({ userId: "test-user", role: "customer", tokenVersion: 2 }, process.env.JWT_SECRET_KEY);
  await request(app).get("/optional").set("Authorization", `Bearer ${accessToken}`).expect(expectedStatus);
});

test("expired access token is rejected", async () => {
  const accessToken = jwt.sign({ userId: "test-user", exp: 1 }, process.env.JWT_SECRET_KEY);
  await request(app).get("/optional").set("Authorization", `Bearer ${accessToken}`).expect(401);
});
