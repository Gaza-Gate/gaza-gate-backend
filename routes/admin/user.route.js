const express = require("express");
const userController = require("../../controllers/admin/user.controller.js");
const asyncWrapper = require("../../utils/http/asyncWrapper.util.js");
const usersValidator = require("../../middlewares/validators/users.validator.js");
const requestsValidator = require("../../middlewares/validators/request.validator.js");
const authenticateAccessToken = require("../../middlewares/auth/verifyToken.middleware.js");
const allowedTo = require("../../middlewares/auth/allowedTo.middleware.js");
const USER_ROLES = require("../../constants/user/userRoles.constant.js");

const router = express.Router();

router.get("/", authenticateAccessToken,allowedTo(USER_ROLES.ADMIN), usersValidator.getUsersValidation,requestsValidator, asyncWrapper(userController.getAllUsers));

//router.post("/", authenticateAccessToken, allowedTo(USER_ROLES.ADMIN), usersValidator.createUserValidation,requestsValidator, asyncWrapper(userController.createUser));

router.patch("/:userId/status", authenticateAccessToken, allowedTo(USER_ROLES.ADMIN), usersValidator.updateStatusValidation,requestsValidator, asyncWrapper(userController.updateUserStatus));

//router.delete("/:userId", authenticateAccessToken,allowedTo(USER_ROLES.ADMIN), usersValidator.userIdValidation,requestsValidator, asyncWrapper(userController.deleteUser));

module.exports = router;
