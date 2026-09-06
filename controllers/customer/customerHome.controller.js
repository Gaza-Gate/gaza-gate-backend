const apiResponse = require("../../utils/http/apiResponse.util.js");
const asyncWrapper = require("../../utils/http/asyncWrapper.util.js");
const customerHomeService = require("../../services/overview/customer/customerHome.service.js");

const getHomePage = asyncWrapper(async (req, res) => {
  const home = await customerHomeService.getHomePage(req);

  return apiResponse.sendSuccess(res, { home }, 200);
});

module.exports = { getHomePage };
