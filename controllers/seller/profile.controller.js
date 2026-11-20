const apiResponse = require("../../utils/http/apiResponse.util.js");
const asyncWrapper = require("../../utils/http/asyncWrapper.util.js");
const profileService = require("../../services/profile/profile.service.js");

const getSellerProfile = asyncWrapper(async (req, res) => {
  const profile = await profileService.getSellerProfile(req.user.id);

  return apiResponse.sendSuccess(res, { profile }, 200);
});

const updateSellerProfile = asyncWrapper(async (req, res) => {
  await profileService.updateSellerProfile(req.user.id, req.body, req.file);

  return apiResponse.sendSuccess(
    res,
    { message: "profile update successfully" },
    200,
  );
});

const updatePassword = asyncWrapper(async (req, res) => {
  await profileService.updatePassword(req.user.id, req.body);

  return apiResponse.sendSuccess(
    res,
    { message: "password update successfully" },
    200,
  );
});



const checkStoreSlugAvailability = asyncWrapper(async (req, res) => {
  const result = await profileService.checkStoreSlugAvailability(req.user.id, req.query.slug);
  return apiResponse.sendSuccess(res, result, 200);
});

const updateStoreSlug = asyncWrapper(async (req, res) => {
  const result = await profileService.updateStoreSlug(req.user.id, req.body.slug);
  return apiResponse.sendSuccess(res, result, 200);
});

module.exports = {
  getSellerProfile,
  updateSellerProfile,
  updatePassword,
  checkStoreSlugAvailability,
  updateStoreSlug,
};