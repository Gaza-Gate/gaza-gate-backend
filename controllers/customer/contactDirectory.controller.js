const asyncWrapper = require("../../utils/http/asyncWrapper.util.js");
const apiResponse = require("../../utils/http/apiResponse.util.js");
const contactDirectoryService = require("../../services/contactDirectory/contactDirectory.service.js");

const listContacts = asyncWrapper(async (req, res) => {
  const payload = await contactDirectoryService.listPublicContacts();
  return apiResponse.sendSuccess(res, payload, 200);
});

module.exports = { listContacts };
