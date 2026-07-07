const apiResponse = require("../utils/apiResponse.util.js");
const asyncWrapper = require("../utils/asyncWrapper.util.js");
const customerProfileService = require("../services/customerProfile.service.js");

const getCustomerProfile = asyncWrapper(async (req, res) => {
  const profile = await customerProfileService.getCustomerProfile(req.user.id);
  return apiResponse.sendSuccess(res, { profile }, 200);
});

const updateCustomerProfile = asyncWrapper(async (req, res) => {
  const profile = await customerProfileService.updateCustomerProfile(
    req.user.id,
    req.body,
    req.file,
  );
  return apiResponse.sendSuccess(res, { profile }, 200);
});

const addAddress = asyncWrapper(async (req, res) => {
  const address = await customerProfileService.addAddress(
    req.user.id,
    req.body,
  );
  return apiResponse.sendSuccess(res, { address }, 201);
});

const updateAddress = asyncWrapper(async (req, res) => {
  const address = await customerProfileService.updateAddress(
    req.user.id,
    req.params.addressId,
    req.body,
  );
  return apiResponse.sendSuccess(res, { address }, 200);
});

const deleteAddress = asyncWrapper(async (req, res) => {
  await customerProfileService.deleteAddress(
    req.user.id,
    req.params.addressId,
  );
  return apiResponse.sendSuccess(res, null, 200);
});

module.exports = {
  getCustomerProfile,
  updateCustomerProfile,
  addAddress,
  updateAddress,
  deleteAddress,
};
