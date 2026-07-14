const router = require("express").Router();
const dashboardController = require("../../controllers/seller/dashboard.controller");
const authenticateAccessToken = require("../../middlewares/auth/verifyToken.middleware");

router.get(
  "/",
  authenticateAccessToken,
  dashboardController.getSellerDashboard,
);

module.exports = router;
