const router = require("express").Router();
const sellerStoreController = require("../../controllers/customer/sellerStore.controller");
const authenticateAccessToken = require("../../middlewares/auth/verifyToken.middleware");

router.get("/:sellerId", authenticateAccessToken,sellerStoreController.getPublicStore);
router.get("/:sellerId/products", authenticateAccessToken,sellerStoreController.getStoreProducts);

module.exports = router;

