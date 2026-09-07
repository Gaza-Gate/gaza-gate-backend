const router = require("express").Router();
const sellerStoreController = require("../../controllers/customer/sellerStore.controller");
const requestsValidator = require("../../middlewares/validators/request.validator.js");
const {
  getPublicStoreValidator,
  getStoreProductsValidator,
} = require("../../middlewares/validators/sellerStore.validator.js");

router.get(
  "/:sellerId",
  getPublicStoreValidator,
  requestsValidator,
  sellerStoreController.getPublicStore,
);
router.get(
  "/:sellerId/products",
  getStoreProductsValidator,
  requestsValidator,
  sellerStoreController.getStoreProducts,
);

module.exports = router;
