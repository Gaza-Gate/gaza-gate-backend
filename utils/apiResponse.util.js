const RESPONSE_STATUS = require("../constants/responseStatus.constant.js");

const sendSuccess = (res, data, statusCode = 200) => {
  return res.status(statusCode).json({
    status: RESPONSE_STATUS.SUCCESS,
    data,
  });
};

const sendFail = (res, data, statusCode = 400) => {
  return res.status(statusCode).json({
    status: RESPONSE_STATUS.FAIL,
    data,
  });
};

const sendError = (
  res,
  message = "Internal Server Error",
  statusCode = 500,
) => {
  return res.status(statusCode).json({
    status: RESPONSE_STATUS.ERROR,
    message,
  });
};

module.exports = {
  sendSuccess,
  sendFail,
  sendError,
};
