const express = require("express");

const requestsValidator = require("../../middlewares/validators/request.validator.js");
const contactDirectoryValidator = require("../../middlewares/validators/contactDirectory.validator.js");
const authenticateAccessToken = require("../../middlewares/auth/verifyToken.middleware.js");
const allowedTo = require("../../middlewares/auth/allowedTo.middleware.js");
const USER_ROLES = require("../../constants/user/userRoles.constant.js");
const filterBody = require("../../middlewares/common/filterBody.middleware.js");
const contactDirectoryController = require("../../controllers/admin/contactDirectory.controller.js");
const {
  CONTACT_DIRECTORY_WRITABLE_FIELDS,
} = require("../../constants/contactDirectory/contactDirectory.constant.js");

const router = express.Router();

router.post(
  "/",authenticateAccessToken,allowedTo(USER_ROLES.ADMIN),
  contactDirectoryValidator.createContactDirectoryValidation,
  requestsValidator,
  contactDirectoryController.createContact,
);

router.get(
  "/",
  authenticateAccessToken,allowedTo( USER_ROLES.ADMIN),
  contactDirectoryValidator.listContactDirectoryValidation,
  requestsValidator,
  contactDirectoryController.listContacts,
);

router.get(
  "/:id",
  authenticateAccessToken,allowedTo(USER_ROLES.ADMIN),
  contactDirectoryValidator.contactIdParamValidation,
  requestsValidator,
  contactDirectoryController.getContact,
);

router.patch(
  "/:id",
  authenticateAccessToken,allowedTo(USER_ROLES.ADMIN),
  contactDirectoryValidator.updateContactDirectoryValidation,
  requestsValidator,
  contactDirectoryController.updateContact,
);

module.exports = router;
