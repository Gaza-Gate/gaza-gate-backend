const crypto = require("crypto");
const {
  deleteEmailVerificationByUserId,
  createEmailVerification,
} = require("./emailVerification.service");

const createVerificationCode = async (userId, type, transaction = null) => {
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await deleteEmailVerificationByUserId(userId, type, transaction);
  await createEmailVerification({ userId, code, type, expiresAt }, transaction);

  return {
    code,
    expiresAt,
  };
};

module.exports = {
  createVerificationCode,
};
