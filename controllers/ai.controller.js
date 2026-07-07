const apiResponse = require("../utils/apiResponse.util.js");
const asyncWrapper = require("../utils/asyncWrapper.util.js");
const aiService = require("../services/ai.service.js");

const generateBrandedProductImage = asyncWrapper(async (req, res) => {
  const result = await aiService.generateBrandedProductImage(req);
  return apiResponse.sendSuccess(res, result, 200);
});

module.exports = { generateBrandedProductImage };
