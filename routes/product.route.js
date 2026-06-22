const router = require("express").Router();
const upload = require("../middlewares/upload/productImageUpload.middleware.js");
const requestsValidator = require("../middlewares/validators/request.validator.js");
const {
  createProductValidator,
  updateProductValidator,
} = require("../middlewares/validators/product.validator.js");
const productController = require("../controllers/product.controller.js");

router.get('/', productController.getSellerProducts);

router.post(
  "/",
  upload(4).array("images", 4),
  createProductValidator,
  requestsValidator,
  productController.createProduct
);

router.patch(
  "/:id",
  upload(4).array("images", 4),
  updateProductValidator,
  requestsValidator,
  productController.updateProduct
);

router.patch('/:id/toggle', productController.toggleStatus);
router.delete('/:id', productController.deleteProduct);

module.exports = router;