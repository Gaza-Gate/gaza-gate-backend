const token = require("./token.util.js");
const USER_ROLES = require("../../constants/user/userRoles.constant.js");
const UserStatus = require("../../constants/user/userStatus.constant.js");
const User = require("../../models/user.model.js");
const Customer = require("../../models/customer.model.js");

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

    const user = await User.findByPk(decoded.userId);
    if (!user || user.status === UserStatus.BANNED) {
      return null;
    }

    const tokenVersionFromPayload = decoded.tokenVersion ?? 0;
    const currentTokenVersion = user.tokenVersion ?? 0;
    if (tokenVersionFromPayload !== currentTokenVersion) {
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
