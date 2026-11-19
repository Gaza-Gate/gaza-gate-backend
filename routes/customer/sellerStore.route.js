const router = require("express").Router();
const sellerStoreController = require("../../controllers/customer/sellerStore.controller");
const requestsValidator = require("../../middlewares/validators/request.validator.js");
const {
  getPublicStoreValidator,
  getStoreProductsValidator,
} = require("../../middlewares/validators/sellerStore.validator.js");
const optionalAuthenticateAccessToken = require("../../middlewares/auth/optionalAuthenticate.middleware.js");


router.get(
  "/:sellerId",
  optionalAuthenticateAccessToken,
  getPublicStoreValidator,
  requestsValidator,
  sellerStoreController.getPublicStore,
);
router.get(
  "/:sellerId/products",
  optionalAuthenticateAccessToken,
  getStoreProductsValidator,
  requestsValidator,
  sellerStoreController.getStoreProducts,
);

module.exports = router;
