const asyncWrapper = require("../../utils/http/asyncWrapper.util.js");
const apiResponse = require("../../utils/http/apiResponse.util.js");
const adminDashboardService = require("../../services/admin/adminDashboard.service.js");

const getDashboard = asyncWrapper(async (req, res) => {
  const result = await adminDashboardService.getAdminDashboard(req);
  return apiResponse.sendSuccess(res, result, 200);
});

module.exports = {
  getDashboard,
};
