const express = require("express");
const authenticateAccessToken = require("../../middlewares/auth/verifyToken.middleware.js");
const allowedTo = require("../../middlewares/auth/allowedTo.middleware.js");
const filterBody = require("../../middlewares/common/filterBody.middleware.js");
const requestsValidator = require("../../middlewares/validators/request.validator.js");
const {
  upsertSellerLocationValidator,
} = require("../../middlewares/validators/map.validator.js");
const USER_ROLES = require("../../constants/user/userRoles.constant.js");
const mapController = require("../../controllers/seller/map.controller.js");

const router = express.Router();

router.get(
  "/location",
  authenticateAccessToken,
  allowedTo(USER_ROLES.SELLER),
  mapController.getSellerLocation,
);

router.put(
  "/location",
  authenticateAccessToken,
  allowedTo(USER_ROLES.SELLER),
  filterBody(["latitude", "longitude"]),
  upsertSellerLocationValidator,
  requestsValidator,
  mapController.upsertSellerLocation,
);

router.delete(
  "/location",
  authenticateAccessToken,
  allowedTo(USER_ROLES.SELLER),
  mapController.deleteSellerLocation,
);

module.exports = router;
