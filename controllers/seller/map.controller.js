const apiResponse = require("../../utils/http/apiResponse.util.js");
const asyncWrapper = require("../../utils/http/asyncWrapper.util.js");
const sellerMapService = require("../../services/map/sellerMap.service.js");

const getSellerLocation = asyncWrapper(async (req, res) => {
  const location = await sellerMapService.getSellerLocation(req.user.id);
  return apiResponse.sendSuccess(res, { location }, 200);
});

const upsertSellerLocation = asyncWrapper(async (req, res) => {
  const location = await sellerMapService.upsertSellerLocation(
    req.user.id,
    req.body,
  );
  return apiResponse.sendSuccess(res, { location }, 200);
});

const deleteSellerLocation = asyncWrapper(async (req, res) => {
  await sellerMapService.deleteSellerLocation(req.user.id);
  return apiResponse.sendSuccess(
    res,
    { message: "Store location removed successfully" },
    200,
  );
});

module.exports = {
  getSellerLocation,
  upsertSellerLocation,
  deleteSellerLocation,
};
