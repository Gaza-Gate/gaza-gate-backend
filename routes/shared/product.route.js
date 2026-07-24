const router = require("express").Router();
const upload = require("../../middlewares/upload/imageUpload.middleware.js");
const requestsValidator = require("../../middlewares/validators/request.validator.js");
const {
  createProductValidator,
  updateProductValidator,
} = require("../../middlewares/validators/product.validator.js");
const {
  getAllProductsPublicValidator,
  getProductDetailsPublicValidator,
} = require("../../middlewares/validators/customerProduct.validator.js");
const productController = require("../../controllers/shared/product.controller.js");
const authenticateAccessToken = require("../../middlewares/auth/verifyToken.middleware.js");
const allowedTo = require("../../middlewares/auth/allowedTo.middleware.js");
const USER_ROLES = require("../../constants/user/userRoles.constant.js");

router.get(
  "/public",
  getAllProductsPublicValidator,
  requestsValidator,
  productController.getAllProductsPublic,
);

router.get(
  "/public/:id",
  getProductDetailsPublicValidator,
  requestsValidator,
  productController.getProductDetailsPublic,
);

router.get(
  "/",
  authenticateAccessToken,
  allowedTo(USER_ROLES.SELLER),
  productController.getSellerProducts,
);

router.get(
  "/:id",
  authenticateAccessToken,
  allowedTo(USER_ROLES.SELLER),
  getProductDetailsPublicValidator,
  requestsValidator,
  productController.getSellerProductDetails,
);

router.post(
  "/",
  authenticateAccessToken,
  allowedTo(USER_ROLES.SELLER),
  upload(1).single("image"),
  createProductValidator,
  requestsValidator,
  productController.createProduct,
);

router.put(
  "/:id",
  authenticateAccessToken,
  allowedTo(USER_ROLES.SELLER),
  upload(1).single("image"),
  updateProductValidator,
  requestsValidator,
  productController.updateProduct,
);

router.patch(
  "/:id/toggle",
  authenticateAccessToken,
  allowedTo(USER_ROLES.SELLER),
  productController.toggleStatus,
);

router.delete(
  "/:id",
  authenticateAccessToken,
  allowedTo(USER_ROLES.SELLER),
  productController.deleteProduct,
);

module.exports = router;
