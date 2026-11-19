const express = require("express");

const asyncWrapper = require("../../utils/http/asyncWrapper.util.js");
const requestsValidator = require("../../middlewares/validators/request.validator.js");
const adminProductValidator = require("../../middlewares/validators/adminProduct.validator.js");
const authenticateAccessToken = require("../../middlewares/auth/verifyToken.middleware.js");
const allowedTo = require("../../middlewares/auth/allowedTo.middleware.js");
const USER_ROLES = require("../../constants/user/userRoles.constant.js");
const filterBody = require("../../middlewares/common/filterBody.middleware.js");

const adminProductController = require("../../controllers/admin/product.controller.js");

const router = express.Router();

router.get(
  "/",
  authenticateAccessToken,
  allowedTo(USER_ROLES.ADMIN),
  adminProductValidator.listAdminProductsValidation,
  requestsValidator,
  asyncWrapper(adminProductController.listProducts),
);

router.patch(
  "/:productId/status",
  authenticateAccessToken,
  allowedTo(USER_ROLES.ADMIN),
  adminProductValidator.updateProductStatusValidation,
  filterBody(["status", "reason"]),
  requestsValidator,
  asyncWrapper(adminProductController.updateProductStatus),
);

router.delete(
  "/:productId",
  authenticateAccessToken,
  allowedTo(USER_ROLES.ADMIN),
  adminProductValidator.deleteAdminProductValidation,
  filterBody(["reason"]),
  requestsValidator,
  asyncWrapper(adminProductController.deleteProduct),
);

module.exports = router;
