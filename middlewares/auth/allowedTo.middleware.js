const tokens = require("../../utils/token.util");
const apiResponse=require("../../utils/apiResponse.util")

const allowedTo = (roles) => {
  return (req, res, next) => {
    const user = req.user;
    const userRole = user.role;

    if (!user || !userRole) {
     return apiResponse.sendFail(res, { message: "Unauthorized" }, 401);
    }

    if (!roles.includes(userRole)) {
      return apiResponse.sendFail(res, { message: "Unauthorized" }, 401);
    }

    next();
  };
};

module.exports = allowedTo;
