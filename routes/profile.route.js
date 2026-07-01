const express = require("express");
const authenticateAccessToken = require("../middlewares/auth/verifyToken.middleware.js");
const {
  updateProfileValidation,
  updatePasswordValidation,
} = require("../middlewares/validators/profile.validator.js");
const requestsValidator = require("../middlewares/validators/request.validator.js");
const profileController = require("../controllers/profile.controller.js");
const upload = require("../middlewares/upload/imageUpload.middleware.js");
const router = express.Router();

router.get("/", authenticateAccessToken, profileController.getSellerProfile);

router.put(
  "/",
  authenticateAccessToken,
  upload(1).single("avatar"),
  updateProfileValidation,
  requestsValidator,
  profileController.updateSellerProfile,
);

router.put(
  "/changePassword",
  authenticateAccessToken,
  updatePasswordValidation,
  requestsValidator,
  profileController.updatePassword,
);

module.exports = router;
