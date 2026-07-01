const tokens = require("../utils/tokens.js");

const allowedTo = (roles) => {
  return (req, res, next) => {
    const user = req.user;
    const userRole = user.role;

    if (!user || !userRole) {
      apiResponse.sendFail(res, { message: "Unauthorized" }, 401);
    }

    if (!roles.includes(userRole)) {
      apiResponse.sendFail(res, { message: "Unauthorized" }, 401);
    }

    next();
  };
};

module.exports = allowedTo;
