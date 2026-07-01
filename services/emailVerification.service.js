const EmailVerification = require("../models/emailVerification.model.js");

const createEmailVerification = async (
  { userId, code, type, expiresAt },
  transaction = null,
) => {
  return await EmailVerification.create(
    {
      userId,
      code,
      type,
      expiresAt,
    },
    { transaction },
  );
};

const getEmailVerificationByUserId = async (
  userId,
  type,
  transaction = null,
) => {
  return await EmailVerification.findOne({
    where: { userId, type },
    transaction,
  });
};

const getEmailVerificationById = async (id, transaction = null) => {
  return await EmailVerification.findByPk(id, { transaction });
};

const updateEmailVerificationByUserId = async (
  userId,
  type,
  { code, expiresAt },
  transaction = null,
) => {
  const verification = await EmailVerification.findOne({
    where: { userId, type },
    transaction,
  });

  if (!verification) return null;

  await verification.update({ code, expiresAt }, { transaction });

  return verification;
};

const deleteEmailVerificationByUserId = async (
  userId,
  type,
  transaction = null,
) => {
  return await EmailVerification.destroy({
    where: { userId, type },
    transaction,
  });
};

const getEmailVerificationByUserIdAndCode = async (
  userId,
  code,
  type,
  transaction = null,
) => {
  return await EmailVerification.findOne({
    where: {
      userId,
      code,
      type,
    },
    transaction,
  });
};

const getLatestEmailVerificationByUserId = async (
  userId,
  type,
  transaction = null,
) => {
  return await EmailVerification.findOne({
    where: { userId, type },
    order: [["created_at", "DESC"]],
    transaction,
  });
};

module.exports = {
  createEmailVerification,
  getEmailVerificationByUserId,
  getEmailVerificationById,
  updateEmailVerificationByUserId,
  deleteEmailVerificationByUserId,
  getEmailVerificationByUserIdAndCode,
  getLatestEmailVerificationByUserId,
};
