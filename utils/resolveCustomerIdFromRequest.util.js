const token = require("./token.util.js");
const USER_ROLES = require("../constants/userRoles.constant.js");
const Customer = require("../models/customer.model.js");

const resolveCustomerIdFromRequest = async (req) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    const accessToken = authHeader.split(" ")[1];
    const decoded = token.verifyAccessToken(accessToken);

    if (decoded.role !== USER_ROLES.CUSTOMER) {
      return null;
    }

    const customer = await Customer.findOne({
      where: { userId: decoded.userId },
      attributes: ["id"],
    });

    return customer?.id ?? null;
  } catch (error) {
    return null;
  }
};

module.exports = resolveCustomerIdFromRequest;