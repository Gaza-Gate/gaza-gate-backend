const router = require("express").Router();
const upload = require("../middlewares/upload/productImageUpload.middleware.js");
const requestsValidator = require("../middlewares/validators/request.validator.js");
const {
  createProductValidator,
  updateProductValidator,
} = require("../middlewares/validators/product.validator.js");
const productController = require("../controllers/product.controller.js");
const authenticateAccessToken = require("../middlewares/auth/verifyToken.middleware.js");

router.get('/', authenticateAccessToken, productController.getSellerProducts);

router.post(
  "/",
  upload(1).single("image"),
  createProductValidator,
  requestsValidator,
  productController.createProduct
);

router.put(
  "/:id",
  upload(1).single("image"),
  updateProductValidator,
  requestsValidator,
  productController.updateProduct
);

router.patch('/:id/toggle', productController.toggleStatus);
router.delete('/:id', productController.deleteProduct);

module.exports = router;