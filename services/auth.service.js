const { sequelize } = require("../config/db.config.js");
const { Sequelize } = require('sequelize');

const {
  getEmailVerificationByUserIdAndCode,
  deleteEmailVerificationByUserId,
  getLatestEmailVerificationByUserId,
} = require("./emailVerification.service");
const { createVerificationCode } = require("./verification.service.js");
const refreshTokenService = require("./refreshToken.service.js");

const User = require("../models/user.model.js");
const UserAuthProvider = require("../models/UserAuthProvider.model.js");
const Customer = require("../models/customer.model.js");
const Seller = require("../models/seller.model.js");
const Role = require("../models/role.model.js");
const RefreshToken = require("../models/refreshToken.model.js");

const userRoles = require("../constants/userRoles.constant.js");
const {
  REFRESH_TOKEN_EXPIRES_IN_MS,
  COOL_DOWN_PERIODS_IN_SECONDS,
  VERIFICATION_TYPES,
} = require("../constants/auth.constant.js");
const userStatus = require("../constants/userStatus.constant.js");

const { hashPassword, comparePassword } = require("../utils/password.util.js");
const token = require("../utils/token.util.js");
const { hashToken } = require("../utils/cryptoHash.util.js");
const AppError = require("../utils/AppError.util.js");
const { 
  sendVerificationEmail,
  sendPasswordResetEmail
} = require("../utils/email.util.js");

const localRegister = async (data, roleName, createProfile) => {
  const { firstName, lastName, email, password } = data;

  const result = await sequelize.transaction(async (transaction) => {
    const existingUser = await User.findOne({ where: { email }, transaction });
    if (existingUser) {
      throw AppError.fail(
        "This email is already registered. Please login.",
        409,
      );
    }

    const role = await Role.findOne({ where: { name: roleName }, transaction });
    if (!role) {
      throw AppError.error(`${roleName} role not found`, 500);
    }

    const hashedPassword = await hashPassword(password, 12);
    const user = await User.create(
      {
        firstName,
        lastName,
        email,
        password: hashedPassword,
        roleId: role.id,
        isVerified: false,
        status: "active",
      },
      { transaction },
    );

    await createProfile(user.id, transaction);

    const { code: otpCode } = await createVerificationCode(
      user.id,
      VERIFICATION_TYPES.EMAIL_ACTIVATE,
      transaction,
    );

    return {
      email: user.email,
      otpCode,
      message:
        "Registration successful. Please check your email for the verification code.",
    };
  });

  try {
    await sendVerificationEmail(result.email, result.otpCode);
  } catch (emailError) {
    console.error("Email sending failed:", emailError);
  }

  return {
    email: result.email,
    message: result.message,
  };
};

const customerLocalRegister = async (data) => {
  return await localRegister(
    data,
    userRoles.CUSTOMER,
    async (userId, transaction) =>
      await Customer.create({ userId }, { transaction }),
  );
};

const sellerLocalRegister = async (data) => {
  return await localRegister(
    data,
    userRoles.SELLER,
    async (userId, transaction) =>
      await Seller.create(
        {
          userId,
          storeName: data.storeName,
          storeDescription: data.storeDescription,
        },
        { transaction },
      ),
  );
};

const verifyEmail = async ({ email, code }) => {
  return await sequelize.transaction(async (transaction) => {
    const user = await User.findOne({
      where: { email },
      transaction,
      lock: Sequelize.Transaction.LOCK.UPDATE,
    });
    if (!user) {
      throw AppError.fail("No account found with this email.", 404);
    }
    if (user.isVerified) {
      throw AppError.fail(
        "This account is already verified. Please login.",
        400,
      );
    }

    const verification = await getEmailVerificationByUserIdAndCode(
      user.id,
      code,
      VERIFICATION_TYPES.EMAIL_ACTIVATE,
      transaction,
    );
    if (!verification) {
      throw AppError.fail("Invalid verification code.", 400);
    }

    if (verification.expiresAt < new Date()) {
      await deleteEmailVerificationByUserId(
        user.id,
        VERIFICATION_TYPES.EMAIL_ACTIVATE,
        transaction
        );
      throw AppError.fail(
        "Verification code has expired. Please request a new one.",
        400,
      );
    }

    await user.update(
      {
        isVerified: true,
      },
      {
        transaction,
      },
    );

    await deleteEmailVerificationByUserId(
      user.id,
      VERIFICATION_TYPES.EMAIL_ACTIVATE,
      transaction
    );

    const role = await Role.findByPk(user.roleId, { transaction });
    if (!role) {
      throw AppError.error("User role not found", 500);
    }

    const accessToken = token.signAccessToken({
      userId: user.id,
      role: role.name,
    });
    const refreshToken = token.signRefreshToken({
      userId: user.id,
      role: role.name,
    });

    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_MS);

    await refreshTokenService.createRefreshToken(
      {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
      transaction,
    );

    const safeUser = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: role.name,
    };
    return {
      user: safeUser,
      accessToken,
      refreshToken,
    };
  });
};

const localLogin = async ({ email, password }, roleName) => {
  return await sequelize.transaction(async (transaction) => {
    const user = await User.findOne({
      where: { email },
      include: [{ model: Role }],
      transaction,
    });

    const roleLabel = roleName === userRoles.SELLER ? "seller" : "customer";
    if (!user) {
      throw AppError.fail(
        `No ${roleLabel} account found with this email.`,
        404,
      );
    }

    if (!user.Role) {
      throw AppError.error("User role not found.", 500);
    }
    const isAllowedRole =
      user.Role.name === roleName || user.Role.name === userRoles.ADMIN;

    if (!isAllowedRole) {
      throw AppError.fail(
        `No ${roleLabel} account found with this email.`,
        404,
      );
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      throw AppError.fail("Invalid email or password.", 401);
    }

    if (!user.isVerified) {
      throw AppError.fail("Please verify your email before logging in.", 403);
    }
    if (user.status !== "active") {
      throw AppError.fail(
        "Your account has been suspended. Please contact support.",
        403,
      );
    }

    const accessToken = token.signAccessToken({
      userId: user.id,
      role: user.Role.name,
    });
    const refreshToken = token.signRefreshToken({
      userId: user.id,
      role: user.Role.name,
    });

    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_MS);

    await refreshTokenService.createRefreshToken(
      { userId: user.id, tokenHash, expiresAt },
      transaction,
    );

    const safeUser = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.Role.name,
    };

    return {
      user: safeUser,
      accessToken,
      refreshToken,
    };
  });
};

const resendVerificationCode = async ({ email }) => {
  const result = await sequelize.transaction(async (transaction) => {
    const user = await User.findOne({
      where: { email },
      transaction,
    });
    if (!user) {
      throw AppError.fail("No account found with this email.", 404);
    }

    if (user.isVerified) {
      throw AppError.fail(
        "This account is already verified. Please login.",
        400,
      );
    }

    const latestVerification = await getLatestEmailVerificationByUserId(
      user.id,
      VERIFICATION_TYPES.EMAIL_ACTIVATE,
      transaction,
    );

    if (latestVerification) {
      const timeDifferenceInSeconds =
        (new Date() - new Date(latestVerification.createdAt)) / 1000;

      if (
        timeDifferenceInSeconds <
        COOL_DOWN_PERIODS_IN_SECONDS.EMAIL_VERIFICATION
      ) {
        throw AppError.fail(
          `You can only request a new verification code once every ${COOL_DOWN_PERIODS_IN_SECONDS.EMAIL_VERIFICATION} seconds. Please try again shortly.`,
          429,
        );
      }
    }

    await deleteEmailVerificationByUserId(
      user.id,
      VERIFICATION_TYPES.EMAIL_ACTIVATE,
      transaction
    );

    const { code: otpCode } = await createVerificationCode(
      user.id,
      VERIFICATION_TYPES.EMAIL_ACTIVATE,
      transaction,
    );

    return {
      email: user.email,
      otpCode,
    };
  });

  try {
    await sendVerificationEmail(result.email, result.otpCode);
  } catch (emailError) {
    console.error("Email sending failed:", emailError);
  }

  return {
    message: "Verification code sent. Please check your email.",
  };
};

const forgotPassword = async ({ email }) => {
  const result = await sequelize.transaction(async (transaction) => {
    const user = await User.findOne({
      where: { email },
      transaction,
      lock: Sequelize.Transaction.LOCK.UPDATE,
    });
    if (!user || user.status !== "active" || !user.isVerified) {
      return null;
    }

    const latestVerification = await getLatestEmailVerificationByUserId(
      user.id,
      VERIFICATION_TYPES.PASSWORD_RESET,
      transaction,
    );

    if (latestVerification) {
      const timeDifferenceInSeconds =
        (new Date() - new Date(latestVerification.createdAt)) / 1000;

      if (
        timeDifferenceInSeconds < COOL_DOWN_PERIODS_IN_SECONDS.PASSWORD_RESET
      ) {
        throw AppError.fail(
          `You can only request a password reset once every ${COOL_DOWN_PERIODS_IN_SECONDS.PASSWORD_RESET} seconds. Please try again shortly.`,
          429,
        );
      }
    }

    await deleteEmailVerificationByUserId(
      user.id,
      VERIFICATION_TYPES.PASSWORD_RESET,
      transaction,
    );

    const { code: resetCode } = await createVerificationCode(
      user.id,
      VERIFICATION_TYPES.PASSWORD_RESET,
      transaction,
    );

    return {
      email: user.email,
      resetCode,
    };
  });

  if (!result) {
    return {
      message: "If this email exists, a code has been sent.",
    };
  }

  try {
    await sendPasswordResetEmail(result.email, result.resetCode);
  } catch (emailError) {
    console.error("Password reset email sending failed:", emailError);
  }

  return {
    message: "If this email exists, a code has been sent.",
  };
};

const verifyResetCode = async ({ email, code }) => {
  return await sequelize.transaction(async (transaction) => {
    const user = await User.findOne({
      where: { email },
      transaction,
      lock: Sequelize.Transaction.LOCK.UPDATE,
    });

    if (!user || user.status !== "active" || !user.isVerified) {
      throw AppError.fail("Invalid email or verification code.", 400);
    }

    const verification = await getEmailVerificationByUserIdAndCode(
      user.id,
      code,
      VERIFICATION_TYPES.PASSWORD_RESET,
      transaction,
    );

    if (!verification) {
      throw AppError.fail("Invalid email or verification code.", 400);
    }

    if (new Date(verification.expiresAt) < new Date()) {
      await deleteEmailVerificationByUserId(
        user.id,
        VERIFICATION_TYPES.PASSWORD_RESET,
        transaction,
      );
      throw AppError.fail(
        "Verification code has expired. Please request a new one.",
        400,
      );
    }

    const resetToken = token.signPendingToken({
      userId: user.id,
      purpose: VERIFICATION_TYPES.PASSWORD_RESET,
    });

    return {
      message: "Code verified successfully. You can now reset your password.",
      resetToken,
    };
  });
};

const resetPassword = async ({ resetToken, newPassword, confirmPassword }) => {
  if (newPassword !== confirmPassword) {
    throw AppError.fail(
      "Passwords do not match. Please ensure both passwords are identical.",
      400,
    );
  }

  let decoded;
  try {
    decoded = token.verifyPendingToken(resetToken);
  } catch (error) {
    throw AppError.fail(
      "Invalid or expired reset token. Please request a new password reset.",
      400,
    );
  }

  if (decoded.purpose !== VERIFICATION_TYPES.PASSWORD_RESET) {
    throw AppError.fail("Invalid token purpose.", 400);
  }

  return await sequelize.transaction(async (transaction) => {
    const user = await User.findByPk(decoded.userId, {
      transaction,
      lock: Sequelize.Transaction.LOCK.UPDATE,
    });

    if (!user || user.status !== "active") {
      throw AppError.fail(
        "User account is invalid, suspended, or does not exist.",
        400,
      );
    }

    const hashedPassword = await hashPassword(newPassword);

    await user.update({ password: hashedPassword }, { transaction });

    await deleteEmailVerificationByUserId(
      user.id,
      VERIFICATION_TYPES.PASSWORD_RESET,
      transaction,
    );

    return {
      message:
        "Password has been reset successfully. You can now log in with your new password.",
    };
  });
};

const customerGoogleRegister = async (payload) => {
  const result = await sequelize.transaction(async (transaction) => {
    const existingUser = await User.findOne({
      where: { email: payload.email },
      transaction
    });
    if (existingUser) {
      throw AppError.fail(
        "This email is already registered. Please login.",
        409,
      );
    }

    const customerRole = await Role.findOne({
      where: { name: userRoles.CUSTOMER },
      transaction,
    });
    if (!customerRole) {
      throw AppError.error("Customer role not found", 500);
    }

    const nameParts = (payload.name || "").trim().split(/\s+/);
    const firstName = payload.given_name || nameParts[0] || "Mohammad";
    const lastName =
      payload.family_name || nameParts.slice(1).join(" ") || "Mohammad";

    const user = await User.create(
      {
        firstName,
        lastName,
        email: payload.email,
        password: null,
        roleId: customerRole.id,
        ...(payload.picture && { avatar: payload.picture }),
        isVerified: true,
        status: "active",
      },
      { transaction },
    );

    await UserAuthProvider.create(
      {
        userId: user.id,
        provider: "google",
        providerId: payload.sub,
      },
      { transaction },
    );

    await Customer.create({ userId: user.id }, { transaction });
    
    const accessToken = token.signAccessToken({
      userId: user.id,
      role: customerRole.name,
    });
    const refreshToken = token.signRefreshToken({
      userId: user.id,
      role: customerRole.name,
    });

    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_MS);

    await refreshTokenService.createRefreshToken(
      { userId: user.id, tokenHash, expiresAt },
      transaction,
    );
    
    const safeUser = user.toJSON();
    delete safeUser.password;
    return {
      user: safeUser,
      accessToken,
      refreshToken
    };
  });

  return result;
};

const customerGoogleLogin = async (payload) => {
  return await sequelize.transaction(async (transaction) => {
    const authProvider = await UserAuthProvider.findOne({
      where: {
        provider: "google",
        providerId: payload.sub,
      },
      include: [{ model: User }],
      transaction,
    });
    if (!authProvider) {
      throw AppError.fail("No account found. Please register first.", 404);
    }

    const user = authProvider.User;

    const role = await Role.findByPk(user.roleId, { transaction });
    if (!role) {
      throw AppError.error("User role not found", 500);
    }
    if (role.name !== userRoles.CUSTOMER) {
      throw AppError.fail(
        "This account is registered as a Seller. Please login from the Seller page.",
        403,
      );
    }

    if (user.status === userStatus.BANNED) {
      throw AppError.fail("Your account has been banned.", 403);
    }

    if (payload.picture && user.avatar !== payload.picture) {
      await user.update({ avatar: payload.picture }, { transaction });
    }

    const accessToken = token.signAccessToken({
      userId: user.id,
      role: role.name,
    });
    const refreshToken = token.signRefreshToken({
      userId: user.id,
      role: role.name,
    });

    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_MS);

    await refreshTokenService.createRefreshToken(
      { userId: user.id, tokenHash, expiresAt },
      transaction,
    );

    const safeUser = user.toJSON();
    delete safeUser.password;
    return { 
      user: safeUser,
      accessToken,
      refreshToken
    };
  });
};

const sellerGoogleRegisterInit = async (payload) => {
  const existingUser = await User.findOne({
    where: { email: payload.email },
  });
  if (existingUser) {
    throw AppError.fail("This email is already registered. Please login.", 409);
  }

  const pendingToken = token.signPendingToken({
    type: "pending_seller",
    googleSub: payload.sub,
    email: payload.email,
    firstName: payload.given_name || "Mohammad",
    lastName: payload.family_name || "Mohammad",
    avatar: payload.picture || null,
  });

  return { pendingToken };
};

const sellerGoogleRegisterComplete = async (data) => {
  const {
    pendingToken,
    storeName,
    storeDescription,
    firstName,
    lastName,
    email,
  } = data;

  let decoded;
  try {
    decoded = token.verifyPendingToken(pendingToken);
  } catch (error) {
    throw AppError.fail(
      "Pending token is invalid or expired. Please try again.",
      401,
    );
  }

  if (decoded.type !== "pending_seller") {
    throw AppError.fail("Invalid token type.", 400);
  }

  if (email && email.trim().toLowerCase() !== decoded.email.toLowerCase()) {
    throw AppError.fail(
      "You cannot change the email address linked to your Google account.",
      400,
    );
  }

  const finalFirstName =
    firstName && firstName.trim() ? firstName.trim() : decoded.firstName;
  const finalLastName =
    lastName && lastName.trim() ? lastName.trim() : decoded.lastName;

  const result = await sequelize.transaction(async (transaction) => {
    const existingUser = await User.findOne({
      where: { email: decoded.email },
      transaction,
    });
    if (existingUser) {
      throw AppError.fail(
        "This email is already registered. Please login.",
        409,
      );
    }

    const sellerRole = await Role.findOne({
      where: { name: userRoles.SELLER },
      transaction,
    });
    if (!sellerRole) {
      throw AppError.error("Seller role not found", 500);
    }

    const user = await User.create(
      {
        firstName: finalFirstName,
        lastName: finalLastName,
        email: decoded.email,
        password: null,
        roleId: sellerRole.id,
        ...(decoded.avatar && { avatar: decoded.avatar }),
        isVerified: true,
        status: "active",
      },
      { transaction },
    );

    await UserAuthProvider.create(
      {
        userId: user.id,
        provider: "google",
        providerId: decoded.googleSub,
      },
      { transaction },
    );

    await Seller.create(
      {
        userId: user.id,
        storeName,
        storeDescription,
      },
      { transaction },
    );
    
    const accessToken = token.signAccessToken({
      userId: user.id,
      role: sellerRole.name,
    });
    const refreshToken = token.signRefreshToken({
      userId: user.id,
      role: sellerRole.name,
    });

    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_MS);

    await refreshTokenService.createRefreshToken(
      { userId: user.id, tokenHash, expiresAt },
      transaction,
    );
    
    const safeUser = user.toJSON();
    delete safeUser.password;
    return { 
      user: safeUser, 
      accessToken,
      refreshToken
    };
  });

  return result;
};

const sellerGoogleLogin = async (payload) => {
  return await sequelize.transaction(async (transaction) => {
    const authProvider = await UserAuthProvider.findOne({
      where: {
        provider: "google",
        providerId: payload.sub,
      },
      include: [{ model: User }],
      transaction,
    });
    if (!authProvider) {
      throw AppError.fail("No account found. Please register first.", 404);
    }

    const user = authProvider.User;

    const role = await Role.findByPk(user.roleId, { transaction });
    if (!role) {
      throw AppError.error("User role not found", 500);
    }
    if (role.name !== userRoles.SELLER) {
      throw AppError.fail(
        "This account is registered as a Customer. Please login from the Customer page.",
        403,
      );
    }

    if (user.status === userStatus.BANNED) {
      throw AppError.fail("Your account has been banned.", 403);
    }

    if (payload.picture && user.avatar !== payload.picture) {
      await user.update({ avatar: payload.picture }, { transaction });
    }

    const accessToken = token.signAccessToken({
      userId: user.id,
      role: role.name,
    });
    const refreshToken = token.signRefreshToken({
      userId: user.id,
      role: role.name,
    });

    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_MS);

    await refreshTokenService.createRefreshToken(
      { userId: user.id, tokenHash, expiresAt },
      transaction,
    );

    const safeUser = user.toJSON();
    delete safeUser.password;

    return { user: safeUser, accessToken, refreshToken };
  });
};

const saveRefreshToken = async (userId, refreshToken, transaction = null) => {
  const tokenHash = hashToken(refreshToken);

  await RefreshToken.create(
    {
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_MS),
    },
    { transaction }
  );
};

const refreshAccessToken = async (oldRefreshToken) => {
  if (!oldRefreshToken) {
    throw AppError.fail("Refresh token is required", 400);
  }

  const payload = token.verifyRefreshToken(oldRefreshToken);
  if (!payload?.userId) {
    throw AppError.fail("Invalid refresh token payload", 401);
  }

  const oldTokenHash = hashToken(oldRefreshToken);

  return await sequelize.transaction(async (t) => {
    const storedToken = await RefreshToken.findOne({
      where: {
        tokenHash: oldTokenHash,
        userId: payload.userId,
      },
      transaction: t,
      lock: Sequelize.Transaction.LOCK.UPDATE
    });

    if (!storedToken) {
      throw AppError.fail("Invalid refresh token", 401);
    }
    if (storedToken.expiresAt < new Date()) {
      throw AppError.fail("Refresh token expired", 401);
    }
    if (storedToken.revokedAt) {
      throw AppError.fail("Refresh token revoked", 400);
    }

    const user = await User.findByPk(payload.userId, { transaction: t });
    if (!user) {
      throw AppError.fail("User not found", 404);
    }

    const role = await Role.findByPk(user.roleId, { transaction: t });
    if (!role) {
      throw AppError.fail("User role not found", 404);
    }

    storedToken.revokedAt = new Date();
    await storedToken.save({ transaction: t });

    const newRefreshToken = token.signRefreshToken({
      userId: user.id,
      role: role.name,
    });
    const newRefreshTokenHash = hashToken(newRefreshToken);

    await RefreshToken.create(
      {
        userId: user.id,
        tokenHash: newRefreshTokenHash,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_MS),
      },
      { transaction: t },
    );

    const newAccessToken = token.signAccessToken({
      userId: user.id,
      role: role.name,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  });
};

module.exports = {
  customerLocalRegister,
  sellerLocalRegister,
  verifyEmail,
  localLogin,
  resendVerificationCode,
  forgotPassword,
  verifyResetCode,
  resetPassword,

  customerGoogleRegister,
  customerGoogleLogin,
  sellerGoogleRegisterInit,
  sellerGoogleRegisterComplete,
  sellerGoogleLogin,

  //getCurrentUser,
  refreshAccessToken,
  //logout,
};
