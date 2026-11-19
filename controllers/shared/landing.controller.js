const landingService = require("../../services/landing/landing.service.js")
const apiResponse = require("../../utils/http/apiResponse.util.js");
const asyncWrapper = require("../../utils/http/asyncWrapper.util.js");

const getLandingState = asyncWrapper(async (req, res) => {
    const data = await landingService.getLandingState();
    return apiResponse.sendSuccess(res, data, 200);
});

module.exports = { getLandingState };