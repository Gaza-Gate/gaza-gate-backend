const router = require("express").Router();
const authenticateAccessToken = require("../middlewares/auth/verifyToken.middleware.js");
const allowedTo = require("../middlewares/auth/allowedTo.middleware.js");
const upload = require("../middlewares/upload/imageUpload.middleware.js");
const requestsValidator = require("../middlewares/validators/request.validator.js");
const USER_ROLES = require("../constants/userRoles.constant.js");
const {
  enhanceProductImageValidator,
} = require("../middlewares/validators/ai.validator.js");
const aiController = require("../controllers/ai.controller.js");

router.post(
  "/product-image",
  authenticateAccessToken,
  allowedTo(USER_ROLES.SELLER),
  upload(2).fields([
    { name: "productImage", maxCount: 1 },
    { name: "identityImage", maxCount: 1 },
  ]),
  enhanceProductImageValidator,
  requestsValidator,
  aiController.generateBrandedProductImage,
);

module.exports = router;
