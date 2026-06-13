const express = require("express");
const authController = require("../controllers/auth.controller.js");
const asyncWrapper = require("../utils/asyncWrapper.util.js");
const filterBody = require("../middlewares/common/filterBody.middleware.js");
const authValidator = require("../middlewares/validators/auth.validator.js");
const requestsValidator = require("../middlewares/validators/request.validator.js");
const googleTokenVerifier = require("../middlewares/auth/googleTokenVerifier.js");
const authenticateAccessToken = require("../middlewares/auth/verifyToken.middleware.js");

const router = express.Router();

router.post(
  "/customer/local/register",
  filterBody(["firstName", "lastName", "email", "password", "confirmPassword"]),
  authValidator.customerLocalRegisterValidator,
  requestsValidator,
  asyncWrapper(authController.customerLocalRegister),
);

router.post(
  "/seller/local/register",
  filterBody([
    "firstName",
    "lastName",
    "email",
    "password",
    "confirmPassword",
    "storeName",
    "storeDescription",
  ]),
  authValidator.sellerLocalRegisterValidator,
  requestsValidator,
  asyncWrapper(authController.sellerLocalRegister),
);

router.post(
  "/customer/local/login",
  filterBody(["email", "password"]),
  authValidator.localLoginValidator,
  requestsValidator,
  asyncWrapper(authController.customerLocalLogin),
);

router.post(
  "/seller/local/login",
  filterBody(["email", "password"]),
  authValidator.localLoginValidator,
  requestsValidator,
  asyncWrapper(authController.sellerLocalLogin),
);

router.post(
  "/verify-email",
  filterBody(["email", "code"]),
  authValidator.verifyEmailValidator,
  requestsValidator,
  asyncWrapper(authController.verifyEmail),
);

router.post(
  "/resend-verification-code",
  filterBody(["email"]),
  authValidator.resendVerificationCodeValidator,
  requestsValidator,
  asyncWrapper(authController.resendVerificationCode),
);

router.post(
  "/forgot-password",
  filterBody(["email"]),
  authValidator.forgotPasswordValidator,
  requestsValidator,
  asyncWrapper(authController.forgotPassword),
);

router.post(
  "/verify-reset-code",
  filterBody(["email", "code"]),
  authValidator.verifyResetCodeValidator,
  requestsValidator,
  asyncWrapper(authController.verifyResetCode),
);

router.post(
  "/reset-password",
  filterBody(["resetToken", "newPassword", "confirmPassword"]),
  authValidator.resetPasswordValidator,
  requestsValidator,
  asyncWrapper(authController.resetPassword),
);

router.post(
  "/customer/google/register",
  filterBody(["token"]),
  authValidator.socialAuthValidator,
  requestsValidator,
  googleTokenVerifier,
  asyncWrapper(authController.customerGoogleRegister),
);

router.post(
  "/customer/google/login",
  filterBody(["token"]),
  authValidator.socialAuthValidator,
  requestsValidator,
  googleTokenVerifier,
  asyncWrapper(authController.customerGoogleLogin),
);

router.post(
  "/seller/google/register/init",
  filterBody(["token"]),
  authValidator.socialAuthValidator,
  requestsValidator,
  googleTokenVerifier,
  asyncWrapper(authController.sellerGoogleRegisterInit),
);

router.post(
  "/seller/google/register/complete",
  filterBody([
    "pendingToken",
    "storeName",
    "storeDescription",
    "firstName",
    "lastName",
    "email",
  ]),
  authValidator.sellerCompleteRegistrationValidator,
  requestsValidator,
  asyncWrapper(authController.sellerGoogleRegisterComplete),
);

router.post(
  "/seller/google/login",
  filterBody(["token"]),
  authValidator.socialAuthValidator,
  requestsValidator,
  googleTokenVerifier,
  asyncWrapper(authController.sellerGoogleLogin),
);

router.post("/refresh-token", asyncWrapper(authController.refreshAccessToken));

router.post("/logout", asyncWrapper(authController.logout));

router.post("/logout-all", authenticateAccessToken, asyncWrapper(authController.logoutAll));

module.exports = router;
