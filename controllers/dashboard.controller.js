const apiResponse = require("../utils/apiResponse.util.js");
const asyncWrapper = require("../utils/asyncWrapper.util.js");
const dashboardService = require("../services/dashboard.service.js");

const getSellerDashboard = asyncWrapper(async (req, res) => {
  const dashboard = await dashboardService.getDashboard(req.user.id);

  return apiResponse.sendSuccess(res, { dashboard }, 200);
});

module.exports = { getSellerDashboard };
