const { sequelize } = require("../../config/db.config.js");
const { Sequelize, UniqueConstraintError } = require("sequelize");

const {
  getEmailVerificationByUserIdAndCode,
  deleteEmailVerificationByUserId,
  getLatestEmailVerificationByUserId,
} = require("./emailVerification.service.js");
const { createVerificationCode } = require("./verification.service.js");
const { getUserProfiles, assertHasProfile } = require("./profile.service.js");
const {
  issueTokenPair,
  buildAuthUserPayload,
} = require("./issueTokens.service.js");

const User = require("../../models/user.model.js");
const UserAuthProvider = require("../../models/UserAuthProvider.model.js");
const Customer = require("../../models/customer.model.js");
const Seller = require("../../models/seller.model.js");
const Role = require("../../models/role.model.js");
const RefreshToken = require("../../models/refreshToken.model.js");
const PasswordResetSession = require("../../models/passwordResetSession.model.js");

const userRoles = require("../../constants/user/userRoles.constant.js");
const {
  REFRESH_TOKEN_EXPIRES_IN_MS,
  COOL_DOWN_PERIODS_IN_SECONDS,
  VERIFICATION_TYPES,
  PASSWORD_RESET_SESSION_EXPIRES_IN_MS,
} = require("../../constants/auth/auth.constant.js");
const userStatus = require("../../constants/user/userStatus.constant.js");

const {
  hashPassword,
  comparePassword,
} = require("../../utils/security/password.util.js");
const token = require("../../utils/security/token.util.js");
const { hashToken } = require("../../utils/security/cryptoHash.util.js");
const AppError = require("../../utils/http/AppError.util.js");
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
} = require("../../utils/email.util.js");

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
          activeRoleId: role.id,
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

  console.log(`[email-verification] ${user.email}: ${otpCode}`);
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

    const roleName = user.role.name;
    const profiles = await getUserProfiles(user.id, transaction);

    const { accessToken, refreshToken } = await issueTokenPair(user, roleName, {
      transaction,
      activeRoleId: user.activeRoleId,
    });

    const safeUser = buildAuthUserPayload(user, roleName, profiles);

    return { user: safeUser, accessToken, refreshToken };
  });
};

const localLogin = async ({ email, password }, roleName) => {
  const user = await User.unscoped().findOne({
    where: { email },
  });

  const hashToCompare = user?.password || process.env.DUMMY_HASH;
  const isPasswordValid = await comparePassword(password, hashToCompare);

  const genericError = AppError.fail("Invalid email or password.", 401);

  if (!user) throw genericError;

  if (!isPasswordValid) throw genericError;

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

  if (!user.isVerified) {
    throw AppError.fail("Please verify your email before logging in.", 403);
  }
  if (user.status !== "active") {
    throw AppError.fail(
      "Your account has been suspended. Please contact support.",
      403,
    );
  }

  const profiles = await getUserProfiles(user.id);
  await assertHasProfile(user.id, roleName, profiles);

  const role = await Role.findOne({ where: { name: roleName } });
  if (!role) {
    throw AppError.error("User role not found.", 500);
  }
  if (user.activeRoleId !== role.id) {
    await user.update({ activeRoleId: role.id });
  }

  const { accessToken, refreshToken } = await issueTokenPair(user, roleName, {
    activeRoleId: role.id,
  });
  const safeUser = buildAuthUserPayload(user, roleName, profiles);

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

    if (process.env.NODE_ENV === "development") {
      console.log(`[email-verification] ${result.email}: ${result.otpCode}`);
      return genericMessage;
    }

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

    // Password reset also invalidates every existing session (local
    // and role-mode alike) — bump tokenVersion too so any access token
    // still inside its 15-minute window dies immediately, not just
    // refresh tokens.
    await Promise.all([
      user.update(
        {
          password: hashedPassword,
          passwordChangedAt: new Date(),
          tokenVersion: user.tokenVersion + 1,
        },
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

// ============================================================
// customerGoogleRegister
// ============================================================
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

  let createdUser;

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

    createdUser = await User.create(
      {
        id: userId,
        firstName,
        lastName,
        email: payload.email,
        password: null,
        activeRoleId: customerRole.id,
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
    ]);
  });

  const profiles = await getUserProfiles(createdUser.id);
  const { accessToken, refreshToken } = await issueTokenPair(
    createdUser,
    userRoles.CUSTOMER,
    { activeRoleId: customerRole.id },
  );
  const safeUser = buildAuthUserPayload(
    createdUser,
    userRoles.CUSTOMER,
    profiles,
  );

  return { user: safeUser, accessToken, refreshToken };
};

// ============================================================
// customerGoogleLogin
//
// Same capability-based change as localLogin: checks for a Customer
// row instead of requiring role.name === "customer".
// ============================================================
const customerGoogleLogin = async (payload) => {
  const authProvider = await UserAuthProvider.findOne({
    where: {
      provider: "google",
      providerId: payload.sub,
    },
    include: [{ model: User, as: "user" }],
  });

  if (!authProvider) {
    throw AppError.fail("No account found. Please register first.", 404);
  }

  const user = authProvider.user;

  if (!user.isVerified) {
    throw AppError.fail("Your account is not verified.", 403);
  }
  if (user.status === userStatus.BANNED) {
    throw AppError.fail("Your account has been banned.", 403);
  }

  const profiles = await getUserProfiles(user.id);
  if (!profiles.hasCustomer) {
    throw AppError.fail(
      "This account doesn't have a Customer profile yet. Please register or switch modes from your account.",
      403,
    );
  }

  const customerRole = await Role.findOne({
    where: { name: userRoles.CUSTOMER },
  });
  if (!customerRole) {
    throw AppError.error("User role not found.", 500);
  }
  if (user.activeRoleId !== customerRole.id) {
    await user.update({ activeRoleId: customerRole.id });
  }

  if (payload.picture && user.avatar !== payload.picture) {
    await user.update({ avatar: payload.picture });
  }

  const { accessToken, refreshToken } = await issueTokenPair(
    user,
    userRoles.CUSTOMER,
    { activeRoleId: customerRole.id },
  );
  const safeUser = buildAuthUserPayload(user, userRoles.CUSTOMER, profiles);

  return { user: safeUser, accessToken, refreshToken };
};

// ============================================================
// sellerGoogleRegisterInit
//
// Changed: previously rejected outright if the email already existed
// as a customer. Now still rejects (Google registration always creates
// a brand-new User row, so an existing email of ANY kind is a
// conflict) — but the error message points existing customers at the
// become-seller flow instead of a dead end.
// ============================================================
const sellerGoogleRegisterInit = async (payload) => {
  const existingUser = await User.findOne({
    where: { email: payload.email },
  });

  if (existingUser) {
    const profiles = await getUserProfiles(existingUser.id);

    if (profiles.hasSeller) {
      throw AppError.fail(
        "This email is already registered as a Seller. Please login.",
        409,
      );
    }

    if (profiles.hasCustomer) {
      throw AppError.fail(
        "This email is already registered as a Customer. Please log in and use 'Become a Seller' from your account instead.",
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
  let createdUser;

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

    createdUser = await User.create(
      {
        id: userId,
        firstName: finalFirstName,
        lastName: finalLastName,
        email: decoded.email,
        password: null,
        activeRoleId: sellerRole.id,
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
    ]);
  });

  const profiles = await getUserProfiles(createdUser.id);
  const { accessToken, refreshToken } = await issueTokenPair(
    createdUser,
    userRoles.SELLER,
    { activeRoleId: sellerRole.id },
  );
  const safeUser = buildAuthUserPayload(
    createdUser,
    userRoles.SELLER,
    profiles,
  );

  return { user: safeUser, accessToken, refreshToken };
};

// ============================================================
// sellerGoogleLogin
// ============================================================
const sellerGoogleLogin = async (payload) => {
  const authProvider = await UserAuthProvider.findOne({
    where: {
      provider: "google",
      providerId: payload.sub,
    },
    include: [{ model: User, as: "user" }],
  });

  if (!authProvider) {
    throw AppError.fail("No account found. Please register first.", 404);
  }

  const user = authProvider.user;

  if (!user.isVerified) {
    throw AppError.fail("Your account is not verified.", 403);
  }
  if (user.status === userStatus.BANNED) {
    throw AppError.fail("Your account has been banned.", 403);
  }

  const profiles = await getUserProfiles(user.id);
  if (!profiles.hasSeller) {
    throw AppError.fail(
      "This account doesn't have a Seller profile yet. Please register or switch modes from your account.",
      403,
    );
  }

  const sellerRole = await Role.findOne({ where: { name: userRoles.SELLER } });
  if (!sellerRole) {
    throw AppError.error("User role not found.", 500);
  }
  if (user.activeRoleId !== sellerRole.id) {
    await user.update({ activeRoleId: sellerRole.id });
  }

  if (payload.picture && user.avatar !== payload.picture) {
    await user.update({ avatar: payload.picture });
  }

  const { accessToken, refreshToken } = await issueTokenPair(
    user,
    userRoles.SELLER,
    { activeRoleId: sellerRole.id },
  );
  const safeUser = buildAuthUserPayload(user, userRoles.SELLER, profiles);

  return { user: safeUser, accessToken, refreshToken };
};

// ============================================================
// refreshAccessToken
//
// Session role comes from RefreshToken.activeRoleId (per-device),
// NOT User.activeRoleId. Rotation must copy that activeRoleId onto
// the new refresh row via issueTokenPair.
// ============================================================
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

    const tokenVersionFromPayload = payload.tokenVersion ?? 0;
    const currentTokenVersion = user.tokenVersion ?? 0;
    if (tokenVersionFromPayload !== currentTokenVersion) {
      throw AppError.fail("Invalid or expired refresh token", 401);
    }

    const role = await Role.findByPk(storedToken.activeRoleId, {
      transaction: t,
    });
    if (!role) throw AppError.fail("User role not found", 404);

    storedToken.revokedAt = new Date();
    await storedToken.save({ transaction: t });

    const { accessToken, refreshToken } = await issueTokenPair(
      user,
      role.name,
      {
        transaction: t,
        activeRoleId: storedToken.activeRoleId,
      },
    );

    return { accessToken, refreshToken };
  });
};

/**
 * Soft-revoke only the calling device's refresh row (by token hash).
 * Never wipes all refresh rows for the user.
 */
const softRevokeCurrentDeviceRefresh = async (
  userId,
  currentRefreshToken,
  transaction,
) => {
  if (!currentRefreshToken) return;

  const tokenHash = hashToken(currentRefreshToken);
  const storedToken = await RefreshToken.findOne({
    where: { tokenHash, userId, revokedAt: null },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (storedToken) {
    storedToken.revokedAt = new Date();
    await storedToken.save({ transaction });
  }
};

const becomeSeller = async (
  userId,
  { storeName, storeDescription },
  currentRefreshToken = null,
) => {
  try {
    return await sequelize.transaction(async (transaction) => {
      const user = await User.findByPk(userId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!user) {
        throw AppError.fail("User not found", 404);
      }
      if (!user.isVerified) {
        throw AppError.fail("Please verify your email before continuing.", 403);
      }
      if (user.status === userStatus.BANNED) {
        throw AppError.fail("Your account has been banned.", 403);
      }

      const profiles = await getUserProfiles(user.id, transaction);
      if (profiles.hasSeller) {
        throw AppError.fail("Already a seller", 409);
      }

      const sellerRole = await Role.findOne({
        where: { name: userRoles.SELLER },
        transaction,
      });
      if (!sellerRole) {
        throw AppError.error("User role not found.", 500);
      }

      await Seller.create(
        {
          userId: user.id,
          storeName,
          storeDescription,
        },
        { transaction },
      );

      // Last-preferred default for future logins — not live session auth.
      if (user.activeRoleId !== sellerRole.id) {
        await user.update(
          { activeRoleId: sellerRole.id },
          { transaction },
        );
      }

      await softRevokeCurrentDeviceRefresh(
        user.id,
        currentRefreshToken,
        transaction,
      );

      const updatedProfiles = await getUserProfiles(user.id, transaction);
      const { accessToken, refreshToken } = await issueTokenPair(
        user,
        userRoles.SELLER,
        { transaction, activeRoleId: sellerRole.id },
      );
      const safeUser = buildAuthUserPayload(
        user,
        userRoles.SELLER,
        updatedProfiles,
      );

      return {
        user: safeUser,
        accessToken,
        refreshToken,
        reconnectSocket: true,
      };
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      throw AppError.fail("Already a seller", 409);
    }
    throw error;
  }
};

const becomeCustomer = async (userId, currentRefreshToken = null) => {
  try {
    return await sequelize.transaction(async (transaction) => {
      const user = await User.findByPk(userId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!user) {
        throw AppError.fail("User not found", 404);
      }
      if (!user.isVerified) {
        throw AppError.fail("Please verify your email before continuing.", 403);
      }
      if (user.status === userStatus.BANNED) {
        throw AppError.fail("Your account has been banned.", 403);
      }

      const profiles = await getUserProfiles(user.id, transaction);
      if (profiles.hasCustomer) {
        throw AppError.fail("Already a customer", 409);
      }

      const customerRole = await Role.findOne({
        where: { name: userRoles.CUSTOMER },
        transaction,
      });
      if (!customerRole) {
        throw AppError.error("User role not found.", 500);
      }

      await Customer.create({ userId: user.id }, { transaction });

      if (user.activeRoleId !== customerRole.id) {
        await user.update(
          { activeRoleId: customerRole.id },
          { transaction },
        );
      }

      await softRevokeCurrentDeviceRefresh(
        user.id,
        currentRefreshToken,
        transaction,
      );

      const updatedProfiles = await getUserProfiles(user.id, transaction);
      const { accessToken, refreshToken } = await issueTokenPair(
        user,
        userRoles.CUSTOMER,
        { transaction, activeRoleId: customerRole.id },
      );
      const safeUser = buildAuthUserPayload(
        user,
        userRoles.CUSTOMER,
        updatedProfiles,
      );

      return {
        user: safeUser,
        accessToken,
        refreshToken,
        reconnectSocket: true,
      };
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      throw AppError.fail("Already a customer", 409);
    }
    throw error;
  }
};

const switchRole = async (
  userId,
  targetRole,
  currentJwtRole,
  currentAccessToken,
  currentRefreshToken = null,
) => {
  if (targetRole !== userRoles.CUSTOMER && targetRole !== userRoles.SELLER) {
    throw AppError.fail('Role must be "customer" or "seller".', 400);
  }

  if (targetRole === currentJwtRole) {
    const profiles = await getUserProfiles(userId);
    const user = await User.findByPk(userId);
    if (!user) {
      throw AppError.fail("User not found", 404);
    }
    const safeUser = buildAuthUserPayload(user, currentJwtRole, profiles);
    return {
      user: safeUser,
      accessToken: currentAccessToken,
      refreshToken: null,
      reconnectSocket: false,
      rotatedRefresh: false,
    };
  }

  return await sequelize.transaction(async (transaction) => {
    const user = await User.findByPk(userId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!user) {
      throw AppError.fail("User not found", 404);
    }
    if (!user.isVerified) {
      throw AppError.fail("Please verify your email before continuing.", 403);
    }
    if (user.status === userStatus.BANNED) {
      throw AppError.fail("Your account has been banned.", 403);
    }

    const profiles = await getUserProfiles(user.id, transaction);
    await assertHasProfile(user.id, targetRole, profiles);

    const role = await Role.findOne({
      where: { name: targetRole },
      transaction,
    });
    if (!role) {
      throw AppError.error("User role not found.", 500);
    }

    // tokenVersion is intentionally NOT bumped — mode change is per-device.

    if (user.activeRoleId !== role.id) {
      await user.update({ activeRoleId: role.id }, { transaction });
    }

    await softRevokeCurrentDeviceRefresh(
      user.id,
      currentRefreshToken,
      transaction,
    );

    const { accessToken, refreshToken } = await issueTokenPair(
      user,
      targetRole,
      { transaction, activeRoleId: role.id },
    );
    const safeUser = buildAuthUserPayload(user, targetRole, profiles);

    return {
      user: safeUser,
      accessToken,
      refreshToken,
      reconnectSocket: true,
      rotatedRefresh: true,
    };
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
  becomeSeller,
  becomeCustomer,
  switchRole,
  logout,
  logoutAll,
};
