const express = require("express");
const authenticateAccessToken = require("../../middlewares/auth/verifyToken.middleware.js");
const allowedTo = require("../../middlewares/auth/allowedTo.middleware.js");
const upload = require("../../middlewares/upload/imageUpload.middleware.js");
const requestsValidator = require("../../middlewares/validators/request.validator.js");
const USER_ROLES = require("../../constants/user/userRoles.constant.js");
const {
  updateCustomerProfileValidator,
  addAddressValidator,
  updateAddressValidator,
  addressIdValidator,
} = require("../../middlewares/validators/customerProfile.validator.js");
const {
  customerIdParamValidator,
} = require("../../middlewares/validators/publicCustomer.validator.js");
const customerProfileController = require("../../controllers/customer/customerProfile.controller.js");
const publicCustomerController = require("../../controllers/customer/publicCustomer.controller.js");

const router = express.Router();

// Private profile (own secure data) — static paths first
router.get(
  "/customer",
  authenticateAccessToken,
  allowedTo(USER_ROLES.CUSTOMER),
  customerProfileController.getCustomerProfile,
);

router.put(
  "/customer",
  authenticateAccessToken,
  allowedTo(USER_ROLES.CUSTOMER),
  upload(1).single("avatar"),
  updateCustomerProfileValidator,
  requestsValidator,
  customerProfileController.updateCustomerProfile,
);

router.post(
  "/customer/address",
  authenticateAccessToken,
  allowedTo(USER_ROLES.CUSTOMER),
  addAddressValidator,
  requestsValidator,
  customerProfileController.addAddress,
);

router.put(
  "/customer/address/:addressId",
  authenticateAccessToken,
  allowedTo(USER_ROLES.CUSTOMER),
  updateAddressValidator,
  requestsValidator,
  customerProfileController.updateAddress,
);

router.delete(
  "/customer/address/:addressId",
  authenticateAccessToken,
  allowedTo(USER_ROLES.CUSTOMER),
  addressIdValidator,
  requestsValidator,
  customerProfileController.deleteAddress,
);

// Public profile (any authenticated user)
router.get(
  "/customer/:customerId",
  authenticateAccessToken,
  customerIdParamValidator,
  requestsValidator,
  publicCustomerController.getPublicCustomerProfile,
);

module.exports = router;
