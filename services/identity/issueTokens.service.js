const token = require("../../utils/security/token.util.js");
const { hashToken } = require("../../utils/security/cryptoHash.util.js");
const refreshTokenService = require("./refreshToken.service.js");
const {
  REFRESH_TOKEN_EXPIRES_IN_MS,
} = require("../../constants/auth/auth.constant.js");

/**
 * Issues access+refresh JWTs and persists a RefreshToken row with the
 * caller-supplied session activeRoleId (per-device mode). Callers must
 * pass activeRoleId explicitly — never inferred from user.activeRoleId.
 */
const issueTokenPair = async (user, roleName, options = {}) => {
  const {
    transaction = null,
    revokeExistingTokens = false,
    activeRoleId,
  } = options;

  if (!activeRoleId) {
    throw new Error("issueTokenPair requires options.activeRoleId");
  }

  if (revokeExistingTokens) {
    await refreshTokenService.revokeAllUserTokens(user.id, transaction);
  }

  const payload = token.buildTokenPayload({
    userId: user.id,
    role: roleName,
    tokenVersion: user.tokenVersion,
  });

  const accessToken = token.signAccessToken(payload);
  const refreshToken = token.signRefreshToken(payload);

  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_MS);

  await refreshTokenService.createRefreshToken(
    { userId: user.id, tokenHash, expiresAt, activeRoleId },
    transaction,
  );

  return { accessToken, refreshToken };
};

const buildAuthUserPayload = (user, roleName, profiles) => {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: roleName,
    hasCustomerProfile: profiles.hasCustomer,
    hasSellerProfile: profiles.hasSeller,
  };
};

module.exports = {
  issueTokenPair,
  buildAuthUserPayload,
};
