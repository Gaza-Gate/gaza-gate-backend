const authService = require("../../services/identity/auth.service.js");
const apiResponse = require("../../utils/http/apiResponse.util.js");
const userRoles = require("../../constants/user/userRoles.constant.js");
const refreshTokenCookieOptions = require("../../utils/security/cookieOptions.util.js");
const AppError = require("../../utils/http/AppError.util.js");

const customerLocalRegister = async (req, res) => {
  const result = await authService.customerLocalRegister(req.body);

  return apiResponse.sendSuccess(
    res,
    {
      email: result.email,
      message: result.message,
    },
    201,
  );
};

const sellerLocalRegister = async (req, res) => {
  const result = await authService.sellerLocalRegister(req.body);

  return apiResponse.sendSuccess(
    res,
    {
      email: result.email,
      message: result.message,
    },
    201,
  );
};

const verifyEmail = async (req, res) => {
  const result = await authService.verifyEmail(req.body);
  res.cookie("refreshToken", result.refreshToken, refreshTokenCookieOptions);

  return apiResponse.sendSuccess(
    res,
    {
      accessToken: result.accessToken,
      user: result.user,
    },
    200,
  );
};

const customerLocalLogin = async (req, res) => {
  const result = await authService.localLogin(req.body, userRoles.CUSTOMER);
  res.cookie("refreshToken", result.refreshToken, refreshTokenCookieOptions);

  return apiResponse.sendSuccess(
    res,
    {
      accessToken: result.accessToken,
      user: result.user,
    },
    200,
  );
};

const sellerLocalLogin = async (req, res) => {
  const result = await authService.localLogin(req.body, userRoles.SELLER);
  res.cookie("refreshToken", result.refreshToken, refreshTokenCookieOptions);

  return apiResponse.sendSuccess(
    res,
    {
      accessToken: result.accessToken,
      user: result.user,
    },
    200,
  );
};

const adminLocalLogin = async (req, res) => {
  const result = await authService.localLogin(req.body, userRoles.ADMIN);
  res.cookie("refreshToken", result.refreshToken, refreshTokenCookieOptions);

  return apiResponse.sendSuccess(
    res,
    {
      accessToken: result.accessToken,
      user: result.user,
    },
    200,
  );
};

const resendVerificationCode = async (req, res) => {
  const result = await authService.resendVerificationCode(req.body);

  return apiResponse.sendSuccess(res, { message: result.message }, 200);
};

const forgotPassword = async (req, res) => {
  const result = await authService.forgotPassword(req.body);

  return apiResponse.sendSuccess(res, { message: result.message }, 200);
};

const verifyResetCode = async (req, res) => {
  const result = await authService.verifyResetCode(req.body);

  return apiResponse.sendSuccess(
    res,
    {
      message: result.message,
      resetToken: result.resetToken,
    },
    200,
  );
};

const resetPassword = async (req, res) => {
  const result = await authService.resetPassword(req.body);

  return apiResponse.sendSuccess(res, { message: result.message }, 200);
};

const customerGoogleRegister = async (req, res) => {
  const result = await authService.customerGoogleRegister(req.googlePayload);
  res.cookie("refreshToken", result.refreshToken, refreshTokenCookieOptions);

  return apiResponse.sendSuccess(
    res,
    { accessToken: result.accessToken, user: result.user },
    201,
  );
};

const customerGoogleLogin = async (req, res) => {
  const result = await authService.customerGoogleLogin(req.googlePayload);
  res.cookie("refreshToken", result.refreshToken, refreshTokenCookieOptions);

  return apiResponse.sendSuccess(
    res,
    { accessToken: result.accessToken, user: result.user },
    200,
  );
};

const sellerGoogleRegisterInit = async (req, res) => {
  const result = await authService.sellerGoogleRegisterInit(req.googlePayload);

  return apiResponse.sendSuccess(
    res,
    { pendingToken: result.pendingToken },
    200,
  );
};

const sellerGoogleRegisterComplete = async (req, res) => {
  const result = await authService.sellerGoogleRegisterComplete(req.body);
  res.cookie("refreshToken", result.refreshToken, refreshTokenCookieOptions);

  return apiResponse.sendSuccess(
    res,
    { accessToken: result.accessToken, user: result.user },
    201,
  );
};

const sellerGoogleLogin = async (req, res) => {
  const result = await authService.sellerGoogleLogin(req.googlePayload);
  res.cookie("refreshToken", result.refreshToken, refreshTokenCookieOptions);

  return apiResponse.sendSuccess(
    res,
    { accessToken: result.accessToken, user: result.user },
    200,
  );
};

const refreshAccessToken = async (req, res) => {
  const oldRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!oldRefreshToken) {
    throw AppError.fail("Refresh token is required", 400);
  }

  const { accessToken, refreshToken } =
    await authService.refreshAccessToken(oldRefreshToken);
  res.cookie("refreshToken", refreshToken, refreshTokenCookieOptions);

  return apiResponse.sendSuccess(res, {
    accessToken,
  });
};

const logout = async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;

  await authService.logout(refreshToken);
  res.clearCookie("refreshToken", refreshTokenCookieOptions);

  return apiResponse.sendSuccess(
    res,
    { message: "Logged out successfully" },
    200,
  );
};

const logoutAll = async (req, res) => {
  await authService.logoutAll(req.user.id);
  res.clearCookie("refreshToken", refreshTokenCookieOptions);

  return apiResponse.sendSuccess(
    res,
    { message: "Logged out from all devices successfully" },
    200,
  );
};

const becomeSeller = async (req, res) => {
  const currentRefreshToken =
    req.cookies?.refreshToken || req.body?.refreshToken || null;

  const result = await authService.becomeSeller(
    req.user.id,
    req.body,
    currentRefreshToken,
  );

  res.cookie("refreshToken", result.refreshToken, refreshTokenCookieOptions);

  return apiResponse.sendSuccess(
    res,
    {
      accessToken: result.accessToken,
      user: result.user,
      // Client must disconnect Socket.IO and reconnect with the new accessToken.
      reconnectSocket: result.reconnectSocket,
    },
    200,
  );
};

const becomeCustomer = async (req, res) => {
  const currentRefreshToken =
    req.cookies?.refreshToken || req.body?.refreshToken || null;

  const result = await authService.becomeCustomer(
    req.user.id,
    currentRefreshToken,
  );

  res.cookie("refreshToken", result.refreshToken, refreshTokenCookieOptions);

  return apiResponse.sendSuccess(
    res,
    {
      accessToken: result.accessToken,
      user: result.user,
      reconnectSocket: result.reconnectSocket,
    },
    200,
  );
};

const switchRole = async (req, res) => {
  const currentRefreshToken =
    req.cookies?.refreshToken || req.body?.refreshToken || null;
  const authHeader = req.headers.authorization || "";
  const currentAccessToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  const result = await authService.switchRole(
    req.user.id,
    req.body.role,
    req.user.role,
    currentAccessToken,
    currentRefreshToken,
  );

  if (result.rotatedRefresh && result.refreshToken) {
    res.cookie("refreshToken", result.refreshToken, refreshTokenCookieOptions);
  }

  return apiResponse.sendSuccess(
    res,
    {
      accessToken: result.accessToken,
      user: result.user,
      reconnectSocket: result.reconnectSocket,
    },
    200,
  );
};

module.exports = {
  customerLocalRegister,
  sellerLocalRegister,
  verifyEmail,
  customerLocalLogin,
  sellerLocalLogin,
  adminLocalLogin,
  resendVerificationCode,
  forgotPassword,
  verifyResetCode,
  resetPassword,

  customerGoogleRegister,
  customerGoogleLogin,
  sellerGoogleRegisterInit,
  sellerGoogleRegisterComplete,
  sellerGoogleLogin,

  refreshAccessToken,
  becomeSeller,
  becomeCustomer,
  switchRole,
  logout,
  logoutAll,
};
