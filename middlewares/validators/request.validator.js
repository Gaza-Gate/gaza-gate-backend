const { validationResult } = require("express-validator");
const apiResponse = require("../../utils/apiResponse.util.js");

const requestsValidator = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return apiResponse.sendFail(
      res,
      {
        errors: errors.array().map((error) => ({
          field: error.path,
          message: error.msg,
        })),
      },
      400,
    );
  }

  next();
};

module.exports = requestsValidator;
