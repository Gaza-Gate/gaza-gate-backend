const asyncWrapper = require("../../utils/http/asyncWrapper.util.js");
const apiResponse = require("../../utils/http/apiResponse.util.js");
const metaService = require("../../services/shared/meta.service.js");

const getProductMeta = asyncWrapper(async (req, res) => {
  const data = await metaService.getProductMeta(req.params.id);
  return apiResponse.sendSuccess(res, data, 200);
});

const getStoreMeta = asyncWrapper(async (req, res) => {
  const data = await metaService.getStoreMeta(req.params.sellerId);
  return apiResponse.sendSuccess(res, data, 200);
});

module.exports = {
  getProductMeta,
  getStoreMeta,
};
