const asyncWrapper = require("../../utils/http/asyncWrapper.util.js");
const apiResponse = require("../../utils/http/apiResponse.util.js");
const contactDirectoryService = require("../../services/contactDirectory/contactDirectory.service.js");

const createContact = asyncWrapper(async (req, res) => {
  const payload = await contactDirectoryService.createContact(req);
  return apiResponse.sendSuccess(res, payload, 201);
});

const listContacts = asyncWrapper(async (req, res) => {
  const payload = await contactDirectoryService.listContacts(req);
  return apiResponse.sendSuccess(res, payload, 200);
});

const getContact = asyncWrapper(async (req, res) => {
  const payload = await contactDirectoryService.getContactById(req);
  return apiResponse.sendSuccess(res, payload, 200);
});

const updateContact = asyncWrapper(async (req, res) => {
  const payload = await contactDirectoryService.updateContact(req);
  return apiResponse.sendSuccess(res, payload, 200);
});

module.exports = {
  createContact,
  listContacts,
  getContact,
  updateContact,
};
