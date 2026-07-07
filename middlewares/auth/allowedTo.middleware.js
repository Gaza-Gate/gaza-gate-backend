const AppError = require("../../utils/AppError.util.js");

const allowedTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return next(AppError.fail("Unauthorized", 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        AppError.fail("You do not have permission to perform this action.", 403),
      );
    }

    next();
  };
};

module.exports = allowedTo;
