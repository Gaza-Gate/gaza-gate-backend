const express = require("express");

const asyncWrapper = require("../../utils/http/asyncWrapper.util.js");
const requestsValidator = require("../../middlewares/validators/request.validator.js");
const adminDashboardValidator = require("../../middlewares/validators/adminDashboard.validator.js");
const authenticateAccessToken = require("../../middlewares/auth/verifyToken.middleware.js");
const allowedTo = require("../../middlewares/auth/allowedTo.middleware.js");
const USER_ROLES = require("../../constants/user/userRoles.constant.js");

const adminDashboardController = require("../../controllers/admin/dashboard.controller.js");

const router = express.Router();

router.get(
  "/",
  authenticateAccessToken,
  allowedTo(USER_ROLES.ADMIN),
  adminDashboardValidator.getAdminDashboardValidation,
  requestsValidator,
  asyncWrapper(adminDashboardController.getDashboard),
);

module.exports = router;
