const uuidValidate = require("uuid-validate");
const apiResponse = require("../../utils/apiResponse");

const idValidator = (paramName) => {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (!id) {
      return apiResponse.sendFail(res, { message: `${paramName} is required` });
    }

    if (!uuidValidate(id, 4)) {
      return apiResponse.sendFail(res, { message: `Invalid ${paramName}` });
    }

    next();
  };
};

module.exports = idValidator;
