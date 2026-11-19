const express = require("express");
const contactDirectoryController = require("../../controllers/customer/contactDirectory.controller.js");

const router = express.Router();

router.get("/", contactDirectoryController.listContacts);

module.exports = router;
