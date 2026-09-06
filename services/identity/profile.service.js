const Customer = require("../../models/customer.model.js");
const Seller = require("../../models/seller.model.js");
const AppError = require("../../utils/http/AppError.util.js");
const userRoles = require("../../constants/user/userRoles.constant.js");

const getUserProfiles = async (userId, transaction = null) => {
  const [customer, seller] = await Promise.all([
    Customer.findOne({ where: { userId }, transaction }),
    Seller.findOne({ where: { userId }, transaction }),
  ]);

  return {
    hasCustomer: Boolean(customer),
    hasSeller: Boolean(seller),
    customerId: customer ? customer.id : null,
    sellerId: seller ? seller.id : null,
  };
};

const assertHasProfile = async (userId, roleName, profiles = null) => {
  if (roleName === userRoles.ADMIN) {
    return;
  }

  const resolvedProfiles = profiles || (await getUserProfiles(userId));

  const hasRequiredProfile =
    roleName === userRoles.CUSTOMER
      ? resolvedProfiles.hasCustomer
      : roleName === userRoles.SELLER
        ? resolvedProfiles.hasSeller
        : false;

  if (!hasRequiredProfile) {
    throw AppError.fail(
      `You don't have a ${roleName} profile yet. Please set one up first.`,
      403,
    );
  }
};

module.exports = { getUserProfiles, assertHasProfile };
