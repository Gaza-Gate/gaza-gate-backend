const express = require("express");
const requestsValidator = require("../../middlewares/validators/request.validator.js");
const {
  getMapStoresValidator,
} = require("../../middlewares/validators/map.validator.js");
const mapController = require("../../controllers/shared/map.controller.js");

const router = express.Router();

router.get(
  "/stores",
  getMapStoresValidator,
  requestsValidator,
  mapController.getMapStores,
);

module.exports = router;
