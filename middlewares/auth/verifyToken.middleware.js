const { User } = require("../../models/associations.js");
const token = require("../../utils/token.util.js");
const AppError = require("../../utils/AppError.util.js");
const UserStatus = require("../../constants/userStatus.constant.js");

const authenticateAccessToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw AppError.fail("Access token is required", 401);
    }
    
    const accessToken = authHeader.split(" ")[1];
    
    let payload;
    try {
      payload = token.verifyAccessToken(accessToken);
    } catch (error) {
      throw AppError.fail("Invalid or expired access token", 401);
    }
    
    const user = await User.findByPk(payload.userId);
    if (!user) {
      throw AppError.fail("User not found", 401);
    }
    
    if (user.status === UserStatus.BANNED) {
      throw AppError.fail("Your account has been banned.", 403);
    }
    
    req.user = {
      id: user.id,
      role: payload.role,
      status: user.status,
    };

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = authenticateAccessToken;