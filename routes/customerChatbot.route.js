const express = require("express");
const customerChatbotController = require("../controllers/customerChatbot.controller.js");
const authenticateAccessToken = require("../middlewares/auth/verifyToken.middleware.js");
const allowedTo = require("../middlewares/auth/allowedTo.middleware.js");
const filterBody = require("../middlewares/common/filterBody.middleware.js");
const chatbotValidator = require("../middlewares/validators/chatbot.validator.js");
const requestsValidator = require("../middlewares/validators/request.validator.js");
const asyncWrapper = require("../utils/asyncWrapper.util.js");
const userRoles = require("../constants/userRoles.constant.js");

const router = express.Router();

router.post(
  "/ask",
  authenticateAccessToken,
  allowedTo(userRoles.CUSTOMER),
  filterBody(["question"]),
  chatbotValidator.askQuestionValidator,
  requestsValidator,
  asyncWrapper(customerChatbotController.askQuestion),
);

module.exports = router;