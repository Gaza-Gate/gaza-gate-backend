const express = require("express");
const sellerChatbotController = require("../controllers/sellerChatbot.controller.js");
const authenticateAccessToken = require("../middlewares/auth/verifyToken.middleware.js");
const allowedTo = require("../middlewares/auth/allowedTo.middleware.js");
const filterBody = require("../middlewares/common/filterBody.middleware.js");
const upload = require("../middlewares/upload/imageUpload.middleware.js");
const sellerChatbotValidator = require("../middlewares/validators/sellerChatbot.validator.js");
const requestsValidator = require("../middlewares/validators/request.validator.js");
const asyncWrapper = require("../utils/asyncWrapper.util.js");
const userRoles = require("../constants/userRoles.constant.js");

const router = express.Router();

router.post(
  "/chat",
  authenticateAccessToken,
  allowedTo(userRoles.SELLER),
  upload(1).single("productImage"),
  filterBody(["message", "sessionId"]),
  sellerChatbotValidator.chatValidator,
  requestsValidator,
  asyncWrapper(sellerChatbotController.chat),
);

router.post(
  "/upload-product-image",
  authenticateAccessToken,
  allowedTo(userRoles.SELLER),
  upload(1).single("productImage"),
  filterBody(["sessionId"]),
  sellerChatbotValidator.uploadImageValidator,
  requestsValidator,
  asyncWrapper(sellerChatbotController.uploadProductImage),
);

router.get(
  "/sessions",
  authenticateAccessToken,
  allowedTo(userRoles.SELLER),
  asyncWrapper(sellerChatbotController.getSessions),
);

router.get(
  "/sessions/:id",
  authenticateAccessToken,
  allowedTo(userRoles.SELLER),
  sellerChatbotValidator.sessionIdParamValidator,
  requestsValidator,
  asyncWrapper(sellerChatbotController.getSessionMessages),
);

module.exports = router;
