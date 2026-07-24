const express = require("express");
const userController = require("../../controllers/admin/user.controller.js");
const asyncWrapper = require("../../utils/http/asyncWrapper.util.js");
const idValidator = require("../../middlewares/validators/id.validator.js");
const requestsValidator = require("../../middlewares/validators/request.validator.js");
const authenticateAccessToken = require("../../middlewares/auth/verifyToken.middleware.js");
const allowedTo = require("../../middlewares/auth/allowedTo.middleware.js");
const USER_ROLES = require("../../constants/user/userRoles.constant.js");

const router = express.Router();

router.get("/", authenticateAccessToken,allowedTo(USER_ROLES.ADMIN), asyncWrapper(userController.getAllUsers));

router.get("/:userId", authenticateAccessToken, idValidator("userId"),requestsValidator, asyncWrapper(userController.getUser));

router.post("/", authenticateAccessToken, requestsValidator, asyncWrapper(userController.createUser));

router.patch("/", authenticateAccessToken, asyncWrapper(userController.updateAllUsers));

router.patch("/:id", authenticateAccessToken, idValidator("id"),requestsValidator, asyncWrapper(userController.updateUser));

router.delete("/:id", authenticateAccessToken, idValidator("id"),requestsValidator, asyncWrapper(userController.deleteUser));

module.exports = router;
