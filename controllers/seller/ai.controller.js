const apiResponse = require("../../utils/http/apiResponse.util.js");
const asyncWrapper = require("../../utils/http/asyncWrapper.util.js");
const aiService = require("../../services/ai/ai.service.js");

const generateBrandedProductImage = asyncWrapper(async (req, res) => {
  const result = await aiService.generateBrandedProductImage(req);
  return apiResponse.sendSuccess(res, result, 200);
});

module.exports = { generateBrandedProductImage };
