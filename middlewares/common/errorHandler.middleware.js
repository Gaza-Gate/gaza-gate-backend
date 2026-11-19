const AppError = require("../../utils/http/AppError.util.js");
const apiResponse = require("../../utils/http/apiResponse.util.js");
const RESPONSE_STATUS = require("../../constants/shared/responseStatus.constant.js");

const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    if (err.status === RESPONSE_STATUS.FAIL) {
      return apiResponse.sendFail(
        res,
        { message: err.message },
        err.statusCode,
      );
    } else {
      console.error(err);
      return apiResponse.sendError(res, err.message, err.statusCode);
    }
  }

  console.error(err);
  return apiResponse.sendError(res, "Internal Server Error", 500);
};

module.exports = errorHandler;
