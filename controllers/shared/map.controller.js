const apiResponse = require("../../utils/http/apiResponse.util.js");
const asyncWrapper = require("../../utils/http/asyncWrapper.util.js");
const mapStoresService = require("../../services/map/mapStores.service.js");

const getMapStores = asyncWrapper(async (req, res) => {
  const data = await mapStoresService.getMapStores(req.query);
  return apiResponse.sendSuccess(res, data, 200);
});

module.exports = { getMapStores };
