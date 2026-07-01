const { sequelize } = require("../config/db.config.js");
const { Sequelize, UniqueConstraintError } = require("sequelize");

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
const PasswordResetSession = require("../models/passwordResetSession.model");

const userRoles = require("../constants/userRoles.constant.js");
const {
  REFRESH_TOKEN_EXPIRES_IN_MS,
  COOL_DOWN_PERIODS_IN_SECONDS,
  VERIFICATION_TYPES,
  PASSWORD_RESET_SESSION_EXPIRES_IN_MS,
} = require("../constants/auth.constant.js");
const userStatus = require("../constants/userStatus.constant.js");

const { hashPassword, comparePassword } = require("../utils/password.util.js");
const token = require("../utils/token.util.js");
const { hashToken } = require("../utils/cryptoHash.util.js");
const AppError = require("../utils/AppError.util.js");
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
} = require("../utils/email.util.js");

const localRegister = async (data, roleName, createProfile) => {
  const { firstName, lastName, email, password } = data;

  const passwordHashPromise = hashPassword(password, 12);
  const rolePromise = Role.findOne({
    where: { name: roleName },
    attributes: ["id"],
  });

  const [hashedPassword, role] = await Promise.all([
    passwordHashPromise,
    rolePromise,
  ]);

  if (!role) {
    throw AppError.error(`${roleName} role not found`, 500);
  }

  let user;
  let otpCode;

  try {
    await sequelize.transaction(async (transaction) => {
      user = await User.create(
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

      const verification = await createVerificationCode(
        user.id,
        VERIFICATION_TYPES.EMAIL_ACTIVATE,
        transaction,
      );

      otpCode = verification.code;
    });
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      console.warn("Duplicate email registration attempt:", email);
      return {
        message:
          "If the email address is not registered, a verification code will be sent to complete your registration.",
      };
    }
    throw err;
  }

  void sendVerificationEmail(user.email, otpCode).catch((emailError) => {
    console.error("Email sending failed:", emailError);
  });

  return {
    message:
      "If the email address is not registered, a verification code will be sent to complete your registration.",
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
      include: [{ model: Role, as: "role" }],
      transaction,
      lock: Sequelize.Transaction.LOCK.UPDATE,
    });

    if (!user || user.isVerified) {
      throw AppError.fail("Invalid or expired verification code.", 400);
    }
    if (!user.role) {
      throw AppError.error("User role not found.", 500);
    }

    const verification = await getEmailVerificationByUserIdAndCode(
      user.id,
      code,
      VERIFICATION_TYPES.EMAIL_ACTIVATE,
      transaction,
    );

    if (!verification) {
      throw AppError.fail("Invalid or expired verification code.", 400);
    }

    if (verification.expiresAt < new Date()) {
      await deleteEmailVerificationByUserId(
        user.id,
        VERIFICATION_TYPES.EMAIL_ACTIVATE,
        transaction,
      );

      throw AppError.fail("Invalid or expired verification code.", 400);
    }

    await Promise.all([
      user.update({ isVerified: true }, { transaction }),
      deleteEmailVerificationByUserId(
        user.id,
        VERIFICATION_TYPES.EMAIL_ACTIVATE,
        transaction,
      ),
    ]);

    const accessToken = token.signAccessToken({
      userId: user.id,
      role: user.role.name,
    });
    const refreshToken = token.signRefreshToken({
      userId: user.id,
      role: user.role.name,
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
      role: user.role.name,
    };

    return { user: safeUser, accessToken, refreshToken };
  });
};

const localLogin = async ({ email, password }, roleName) => {
  const user = await User.unscoped().findOne({
    where: { email },
    include: [{ model: Role, as: "role" }],
  });

  const hashToCompare = user?.password || process.env.DUMMY_HASH;
  const isPasswordValid = await comparePassword(password, hashToCompare);

  const genericError = AppError.fail("Invalid email or password.", 401);

  if (!user) throw genericError;
  if (!user.role) throw AppError.error("User role not found.", 500);

  const isAllowedRole =
    user.role.name === roleName || user.role.name === userRoles.ADMIN;
  if (!isAllowedRole) throw genericError;

  if (!user.password) {
    const authProvider = await UserAuthProvider.findOne({
      where: { userId: user.id },
    });
    if (authProvider) {
      throw AppError.fail(
        `This account uses ${authProvider.provider} login. Please sign in with ${authProvider.provider}.`,
        400,
      );
    }
  }

  if (!isPasswordValid) throw genericError;

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
    role: user.role.name,
  });
  const refreshToken = token.signRefreshToken({
    userId: user.id,
    role: user.role.name,
  });

  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_MS);

  await refreshTokenService.createRefreshToken({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  const safeUser = {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role.name,
  };

  return { user: safeUser, accessToken, refreshToken };
};

const resendVerificationCode = async ({ email }) => {
  const genericMessage = {
    message:
      "If this email is registered and unverified, a verification code will be sent.",
  };

  const cooldownSeconds = COOL_DOWN_PERIODS_IN_SECONDS.EMAIL_VERIFICATION;

  let result = null;

  result = await sequelize.transaction(async (transaction) => {
    const user = await User.findOne({
      where: { email },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!user || user.isVerified) {
      return { status: "not_eligible" };
    }

    const latestVerification = await getLatestEmailVerificationByUserId(
      user.id,
      VERIFICATION_TYPES.EMAIL_ACTIVATE,
      transaction,
    );

    if (latestVerification) {
      const timeDifferenceInSeconds =
        (Date.now() - new Date(latestVerification.created_at).getTime()) / 1000;

      if (timeDifferenceInSeconds < cooldownSeconds) {
        const remainingSeconds = Math.ceil(
          cooldownSeconds - timeDifferenceInSeconds,
        );

        return {
          status: "cooldown",
          remainingSeconds,
        };
      }
    }

    await deleteEmailVerificationByUserId(
      user.id,
      VERIFICATION_TYPES.EMAIL_ACTIVATE,
      transaction,
    );

    const { code: otpCode } = await createVerificationCode(
      user.id,
      VERIFICATION_TYPES.EMAIL_ACTIVATE,
      transaction,
    );

    return {
      status: "sent",
      userId: user.id,
      email: user.email,
      otpCode,
    };
  });

  if (result.status === "not_eligible") {
    return genericMessage;
  }

  if (result.status === "cooldown") {
    throw AppError.fail(
      `Please wait ${Math.ceil(result.remainingSeconds / 60)} minute(s) before requesting a new verification code.`,
      429,
    );
  }

  try {
    await sendVerificationEmail(result.email, result.otpCode);
  } catch (emailError) {
    console.error("Email sending failed:", emailError);

    await deleteEmailVerificationByUserId(
      result.userId,
      VERIFICATION_TYPES.EMAIL_ACTIVATE,
    );

    throw AppError.error(
      "Failed to send verification email. Please try again later.",
      500,
    );
  }

  return genericMessage;
};

const forgotPassword = async ({ email }) => {
  const genericMessage = {
    message: "If this email exists, a code has been sent.",
  };

  const cooldownSeconds = COOL_DOWN_PERIODS_IN_SECONDS.PASSWORD_RESET;

  const result = await sequelize.transaction(async (transaction) => {
    const user = await User.findOne({
      where: { email },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!user || user.status !== "active" || !user.isVerified) {
      return { status: "not_eligible" };
    }

    const latestVerification = await getLatestEmailVerificationByUserId(
      user.id,
      VERIFICATION_TYPES.PASSWORD_RESET,
      transaction,
    );

    if (latestVerification) {
      const timeDifferenceInSeconds =
        (Date.now() - new Date(latestVerification.created_at).getTime()) / 1000;

      if (timeDifferenceInSeconds < cooldownSeconds) {
        const remainingSeconds = Math.ceil(
          cooldownSeconds - timeDifferenceInSeconds,
        );

        return {
          status: "cooldown",
          remainingSeconds,
        };
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
      status: "sent",
      userId: user.id,
      email: user.email,
      resetCode,
    };
  });

  if (result.status === "not_eligible") {
    return genericMessage;
  }

  if (result.status === "cooldown") {
    throw AppError.fail(
      `Please wait ${Math.ceil(result.remainingSeconds / 60)} minute(s) before requesting a new password reset code.`,
      429,
    );
  }

  try {
    await sendPasswordResetEmail(result.email, result.resetCode);
  } catch (emailError) {
    console.error("Password reset email sending failed:", emailError);

    await deleteEmailVerificationByUserId(
      result.userId,
      VERIFICATION_TYPES.PASSWORD_RESET,
    );

    throw AppError.error(
      "Failed to send password reset email. Please try again later.",
      500,
    );
  }

  return genericMessage;
};

const verifyResetCode = async ({ email, code }) => {
  const genericError = AppError.fail(
    "Invalid email or verification code.",
    400,
  );

  let sessionId = null;
  let userId = null;

  await sequelize.transaction(async (transaction) => {
    const user = await User.findOne({
      where: { email },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!user || user.status !== "active" || !user.isVerified) {
      throw genericError;
    }

    const verification = await getEmailVerificationByUserIdAndCode(
      user.id,
      code,
      VERIFICATION_TYPES.PASSWORD_RESET,
      transaction,
    );

    if (!verification) throw genericError;

    if (new Date(verification.expiresAt) < new Date()) {
      await deleteEmailVerificationByUserId(
        user.id,
        VERIFICATION_TYPES.PASSWORD_RESET,
        transaction,
      );

      throw genericError;
    }

    await deleteEmailVerificationByUserId(
      user.id,
      VERIFICATION_TYPES.PASSWORD_RESET,
      transaction,
    );

    const passwordResetSession = await PasswordResetSession.create(
      {
        userId: user.id,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_SESSION_EXPIRES_IN_MS),
      },
      { transaction },
    );
    sessionId = passwordResetSession.id;
    userId = user.id;
  });

  const resetToken = token.signPendingToken({
    sessionId,
    userId,
    purpose: VERIFICATION_TYPES.PASSWORD_RESET,
  });

  return {
    message: "Code verified successfully. You can now reset your password.",
    resetToken,
  };
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
    throw AppError.fail(
      "Invalid or expired reset token. Please request a new password reset.",
      400,
    );
  }

  const hashedPassword = await hashPassword(newPassword);

  const genericError = AppError.fail(
    "Invalid or expired reset token. Please request a new password reset.",
    400,
  );

  await sequelize.transaction(async (transaction) => {
    const [user, resetSession] = await Promise.all([
      User.findByPk(decoded.userId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      }),
      PasswordResetSession.findByPk(decoded.sessionId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      }),
    ]);

    if (!user || user.status !== "active" || !user.isVerified) {
      throw genericError;
    }

    if (
      !resetSession ||
      resetSession.userId !== decoded.userId ||
      resetSession.expiresAt < new Date() ||
      resetSession.usedAt
    ) {
      throw genericError;
    }

    await Promise.all([
      user.update(
        { password: hashedPassword, passwordChangedAt: new Date() },
        { transaction },
      ),
      resetSession.update({ usedAt: new Date() }, { transaction }),
      RefreshToken.destroy({
        where: { userId: user.id },
        transaction,
      }),
    ]);
  });

  return {
    message:
      "Password has been reset successfully. You can now log in with your new password.",
  };
};

const customerGoogleRegister = async (payload) => {
  const customerRole = await Role.findOne({
    where: { name: userRoles.CUSTOMER },
  });
  if (!customerRole) {
    throw AppError.error("Customer role not found.", 500);
  }

  const nameParts = (payload.name || "").trim().split(/\s+/);
  const firstName = payload.given_name || nameParts[0] || "Mohammad";
  const lastName =
    payload.family_name || nameParts.slice(1).join(" ") || "Mohammad";

  const userId = require("crypto").randomUUID();

  const accessToken = token.signAccessToken({
    userId,
    role: customerRole.name,
  });
  const refreshToken = token.signRefreshToken({
    userId,
    role: customerRole.name,
  });

  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_MS);

  await sequelize.transaction(async (transaction) => {
    const existingUser = await User.findOne({
      where: { email: payload.email },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (existingUser) {
      throw AppError.fail(
        "An account with this email already exists. Please login.",
        409,
      );
    }

    await User.create(
      {
        id: userId,
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

    await Promise.all([
      UserAuthProvider.create(
        {
          userId,
          provider: "google",
          providerId: payload.sub,
        },
        { transaction },
      ),
      Customer.create({ userId }, { transaction }),
      refreshTokenService.createRefreshToken(
        { userId, tokenHash, expiresAt },
        transaction,
      ),
    ]);
  });

  const safeUser = {
    id: userId,
    firstName,
    lastName,
    email: payload.email,
    role: customerRole.name,
  };

  return { user: safeUser, accessToken, refreshToken };
};

const customerGoogleLogin = async (payload) => {
  const authProvider = await UserAuthProvider.findOne({
    where: {
      provider: "google",
      providerId: payload.sub,
    },
    include: [
      {
        model: User,
        as: "user",
        include: [{ model: Role, as: "role" }],
      },
    ],
  });

  if (!authProvider) {
    throw AppError.fail("No account found. Please register first.", 404);
  }

  const user = authProvider.user;
  const role = user.role;

  if (!role) {
    throw AppError.error("User role not found.", 500);
  }
  if (role.name !== userRoles.CUSTOMER) {
    throw AppError.fail(
      "This account is registered as a Seller. Please login from the Seller page.",
      403,
    );
  }
  if (!user.isVerified) {
    throw AppError.fail("Your account is not verified.", 403);
  }
  if (user.status === userStatus.BANNED) {
    throw AppError.fail("Your account has been banned.", 403);
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

  await sequelize.transaction(async (transaction) => {
    const writes = [
      refreshTokenService.createRefreshToken(
        { userId: user.id, tokenHash, expiresAt },
        transaction,
      ),
    ];

    if (payload.picture && user.avatar !== payload.picture) {
      writes.push(user.update({ avatar: payload.picture }, { transaction }));
    }

    await Promise.all(writes);
  });

  const safeUser = {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: role.name,
  };

  return { user: safeUser, accessToken, refreshToken };
};

const sellerGoogleRegisterInit = async (payload) => {
  const existingUser = await User.findOne({
    where: { email: payload.email },
    include: [{ model: Role, as: "role" }],
  });

  if (existingUser) {
    const roleName = existingUser.role?.name;

    if (roleName === userRoles.SELLER) {
      throw AppError.fail(
        "This email is already registered as a Seller. Please login.",
        409,
      );
    }

    if (roleName === userRoles.CUSTOMER) {
      throw AppError.fail(
        "This email is already registered as a Customer. Please login from the Customer page.",
        409,
      );
    }

    throw AppError.fail("This email is already registered. Please login.", 409);
  }

  const nameParts = (payload.name || "").trim().split(/\s+/);
  const firstName = payload.given_name || nameParts[0] || "Mohammad";
  const lastName =
    payload.family_name || nameParts.slice(1).join(" ") || "Mohammad";

  const pendingToken = token.signPendingToken({
    type: "pending_seller",
    googleSub: payload.sub,
    email: payload.email,
    firstName,
    lastName,
    avatar: payload.picture || null,
  });

  return { pendingToken };
};

/////////////////////////////////////////////////////////////////////////////////////////////////

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

  const sellerRole = await Role.findOne({
    where: { name: userRoles.SELLER },
  });
  if (!sellerRole) {
    throw AppError.error("Seller role not found.", 500);
  }

  const userId = require("crypto").randomUUID();

  const accessToken = token.signAccessToken({
    userId,
    role: sellerRole.name,
  });
  const refreshToken = token.signRefreshToken({
    userId,
    role: sellerRole.name,
  });

  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_MS);

  await sequelize.transaction(async (transaction) => {
    const existingUser = await User.findOne({
      where: { email: decoded.email },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (existingUser) {
      throw AppError.fail(
        "This email is already registered. Please login.",
        409,
      );
    }

    await User.create(
      {
        id: userId,
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

    await Promise.all([
      UserAuthProvider.create(
        {
          userId,
          provider: "google",
          providerId: decoded.googleSub,
        },
        { transaction },
      ),
      Seller.create(
        {
          userId,
          storeName,
          storeDescription,
        },
        { transaction },
      ),
      refreshTokenService.createRefreshToken(
        { userId, tokenHash, expiresAt },
        transaction,
      ),
    ]);
  });

  const safeUser = {
    id: userId,
    firstName: finalFirstName,
    lastName: finalLastName,
    email: decoded.email,
    role: sellerRole.name,
  };

  return { user: safeUser, accessToken, refreshToken };
};

const sellerGoogleLogin = async (payload) => {
  const authProvider = await UserAuthProvider.findOne({
    where: {
      provider: "google",
      providerId: payload.sub,
    },
    include: [
      {
        model: User,
        as: "user",
        include: [{ model: Role, as: "role" }],
      },
    ],
  });

  if (!authProvider) {
    throw AppError.fail("No account found. Please register first.", 404);
  }

  const user = authProvider.user;
  const role = user.role;

  if (!role) {
    throw AppError.error("User role not found.", 500);
  }

  if (role.name !== userRoles.SELLER) {
    throw AppError.fail(
      "This account is registered as a Customer. Please login from the Customer page.",
      403,
    );
  }

  if (!user.isVerified) {
    throw AppError.fail("Your account is not verified.", 403);
  }

  if (user.status === userStatus.BANNED) {
    throw AppError.fail("Your account has been banned.", 403);
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

  await sequelize.transaction(async (transaction) => {
    const writes = [
      refreshTokenService.createRefreshToken(
        { userId: user.id, tokenHash, expiresAt },
        transaction,
      ),
    ];

    if (payload.picture && user.avatar !== payload.picture) {
      writes.push(user.update({ avatar: payload.picture }, { transaction }));
    }

    await Promise.all(writes);
  });

  const safeUser = {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: role.name,
  };

  return { user: safeUser, accessToken, refreshToken };
};

const saveRefreshToken = async (userId, refreshToken, transaction = null) => {
  const tokenHash = hashToken(refreshToken);

  await RefreshToken.create(
    {
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_MS),
    },
    { transaction },
  );
};

const refreshAccessToken = async (oldRefreshToken) => {
  let payload;
  try {
    payload = token.verifyRefreshToken(oldRefreshToken);
  } catch (error) {
    throw AppError.fail("Invalid or expired refresh token", 401);
  }

  if (!payload?.userId) {
    throw AppError.fail("Invalid refresh token payload", 401);
  }

  const oldTokenHash = hashToken(oldRefreshToken);

  return await sequelize.transaction(async (t) => {
    const storedToken = await RefreshToken.findOne({
      where: { tokenHash: oldTokenHash, userId: payload.userId },
      transaction: t,
      lock: Sequelize.Transaction.LOCK.UPDATE,
    });

    if (!storedToken) throw AppError.fail("Invalid refresh token", 401);
    if (storedToken.expiresAt < new Date())
      throw AppError.fail("Refresh token expired", 401);
    if (storedToken.revokedAt)
      throw AppError.fail("Refresh token revoked", 401);

    const user = await User.findByPk(payload.userId, { transaction: t });
    if (!user) throw AppError.fail("User not found", 404);

    if (user.status === userStatus.BANNED) {
      throw AppError.fail("Your account has been banned.", 403);
    }

    const role = await Role.findByPk(user.roleId, { transaction: t });
    if (!role) throw AppError.fail("User role not found", 404);

    storedToken.revokedAt = new Date();
    await storedToken.save({ transaction: t });

    const newRefreshToken = token.signRefreshToken({
      userId: user.id,
      role: role.name,
    });
    await RefreshToken.create(
      {
        userId: user.id,
        tokenHash: hashToken(newRefreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_MS),
      },
      { transaction: t },
    );

    const newAccessToken = token.signAccessToken({
      userId: user.id,
      role: role.name,
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  });
};

const logout = async (refreshToken) => {
  if (!refreshToken) return;

  const tokenHash = hashToken(refreshToken);
  await RefreshToken.destroy({
    where: { tokenHash },
  });
};

const logoutAll = async (userId) => {
  await RefreshToken.destroy({
    where: { userId },
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

  refreshAccessToken,
  logout,
  logoutAll,
};
