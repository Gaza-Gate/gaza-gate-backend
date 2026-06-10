const express = require("express");
const userController = require("../controller/user.controller.js");
const asyncWrapper = require("../utils/asyncWrapper.js");
const idValidator = require("../middlewears/validators/idValidator.js");
const filterBody = require("../middlewares/filterBody.js");
const userValidator = require("../middlewares/userValidator.js");
const requestsValidator = require("../middlewares/requestValidator.js");

const router = express.Router();

router.get("/", asyncWrapper(userController.getAllUsers));

router.get("/:userId", asyncWrapper(userController.getUser));

router.post("/", asyncWrapper(userController.createUser));

router.patch("/", asyncWrapper(userController.updateAllUsers));

router.patch("/:id", asyncWrapper(userController.updateUser));

router.delete("/:id", asyncWrapper(userController.deleteUser));

module.exports = router;
