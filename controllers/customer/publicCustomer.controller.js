const publicCustomerService = require("../../services/profile/publicCustomer.service.js");
const apiResponse = require("../../utils/http/apiResponse.util.js");
const asyncWrapper = require("../../utils/http/asyncWrapper.util.js");

const getPublicCustomerProfile = asyncWrapper(async (req, res) => {
  const data = await publicCustomerService.getPublicCustomerProfile(
    req.params.customerId,
  );
  return apiResponse.sendSuccess(res, data, 200);
});

module.exports = {
  getPublicCustomerProfile,
};
