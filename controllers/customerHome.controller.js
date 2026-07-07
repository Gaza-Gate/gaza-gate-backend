const apiResponse = require("../utils/apiResponse.util.js");
const asyncWrapper = require("../utils/asyncWrapper.util.js");
const customerHomeService = require("../services/customerHome.service.js");

const getHomePage = asyncWrapper(async (req, res) => {
  const home = await customerHomeService.getHomePage(req);

  return apiResponse.sendSuccess(res, { home }, 200);
});

module.exports = { getHomePage };
