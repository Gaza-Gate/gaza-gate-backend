const storeService = require('../../services/profile/sellerStore.service');
const apiResponse  = require('../../utils/http/apiResponse.util');
const asyncWrapper = require('../../utils/http/asyncWrapper.util');
 
const getPublicStore = asyncWrapper(async (req, res) => {
  const data = await storeService.getPublicStore(req.params.sellerId);
  return apiResponse.sendSuccess(res, data, 200);
});
 
const getStoreProducts = asyncWrapper(async (req, res) => {
  const data = await storeService.getStoreProducts(
    req.params.sellerId,
    req.query
  );
  return apiResponse.sendSuccess(res, data, 200);
});
 
module.exports = { getPublicStore, getStoreProducts };