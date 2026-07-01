const RefreshToken = require("../models/refreshToken.model.js");
const { Op } = require("sequelize");

const createRefreshToken = async (
  { userId, tokenHash, expiresAt },
  transaction = null,
) => {
  return await RefreshToken.create(
    {
      userId,
      tokenHash,
      expiresAt,
    },
    { transaction },
  );
};

const findActiveTokenByHashAndUser = async (
  tokenHash,
  userId,
  transaction = null,
) => {
  return await RefreshToken.findOne({
    where: {
      tokenHash,
      userId,
      revokedAt: null,
      expiresAt: {
        [Op.gt]: new Date(),
      },
    },
    transaction,
  });
};

const revokeTokenByHash = async (tokenHash, transaction = null) => {
  return await RefreshToken.update(
    { revokedAt: new Date() },
    {
      where: { tokenHash, revokedAt: null },
      transaction,
    },
  );
};

const revokeAllUserTokens = async (userId, transaction = null) => {
  return await RefreshToken.update(
    { revokedAt: new Date() },
    {
      where: { userId, revokedAt: null },
      transaction,
    },
  );
};

const deleteExpiredOrRevokedTokens = async () => {
  return await RefreshToken.destroy({
    where: {
      [Op.or]: [
        { expiresAt: { [Op.lt]: new Date() } },
        { revokedAt: { [Op.ne]: null } },
      ],
    },
  });
};

module.exports = {
  createRefreshToken,
  findActiveTokenByHashAndUser,
  revokeTokenByHash,
  revokeAllUserTokens,
  deleteExpiredOrRevokedTokens,
};
