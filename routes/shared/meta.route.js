const router = require("express").Router();
const requestsValidator = require("../../middlewares/validators/request.validator.js");
const {
  getProductMetaValidator,
  getStoreMetaValidator,
} = require("../../middlewares/validators/meta.validator.js");
const metaController = require("../../controllers/shared/meta.controller.js");

router.get(
  "/product/:id",
  getProductMetaValidator,
  requestsValidator,
  metaController.getProductMeta,
);

router.get(
  "/store/:sellerId",
  getStoreMetaValidator,
  requestsValidator,
  metaController.getStoreMeta,
);

module.exports = router;
