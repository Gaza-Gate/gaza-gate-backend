const RESPONSE_STATUS = require("../constants/responseStatus.constant.js");

class AppError extends Error {
  constructor(
    statusCode = 500,
    status = RESPONSE_STATUS.ERROR,
    message = "Internal Server Error",
  ) {
    super(message);
    this.statusCode = statusCode;
    this.status = status;

    Error.captureStackTrace(this, this.constructor);
  }

  static fail(message, statusCode = 400) {
    return new AppError(statusCode, RESPONSE_STATUS.FAIL, message);
  }

  static error(message, statusCode = 500) {
    return new AppError(statusCode, RESPONSE_STATUS.ERROR, message);
  }
}

module.exports = AppError;
