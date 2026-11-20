const express = require("express");
const authenticateAccessToken = require("../../middlewares/auth/verifyToken.middleware.js");
const {
  updateProfileValidation,
  updatePasswordValidation,
  storeSlugAvailabilityValidation,
  updateStoreSlugValidation,
} = require("../../middlewares/validators/profile.validator.js");
const requestsValidator = require("../../middlewares/validators/request.validator.js");
const profileController = require("../../controllers/seller/profile.controller.js");
const upload = require("../../middlewares/upload/imageUpload.middleware.js");
const allowedTo = require("../../middlewares/auth/allowedTo.middleware.js");
const USER_ROLES = require("../../constants/user/userRoles.constant.js");
const router = express.Router();


router.get(
  "/",
  authenticateAccessToken,
  allowedTo(USER_ROLES.SELLER),
  profileController.getSellerProfile,
);

router.put(
  "/",
  authenticateAccessToken,
  allowedTo(USER_ROLES.SELLER),
  upload(1).single("avatar"),
  updateProfileValidation,
  requestsValidator,
  profileController.updateSellerProfile,
);

router.put(
  "/changePassword",
  authenticateAccessToken,
  allowedTo(USER_ROLES.SELLER),
  updatePasswordValidation,
  requestsValidator,
  profileController.updatePassword,
);

// Store link: gazagate.store/store/<slug>
router.get(
  "/slug/availability",
  authenticateAccessToken,
  allowedTo(USER_ROLES.SELLER),
  storeSlugAvailabilityValidation,
  requestsValidator,
  profileController.checkStoreSlugAvailability,
);

router.put(
  "/slug",
  authenticateAccessToken,
  allowedTo(USER_ROLES.SELLER),
  updateStoreSlugValidation,
  requestsValidator,
  profileController.updateStoreSlug,
);

module.exports = router;
