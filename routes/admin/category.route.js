const router = require("express").Router();
const categoryController = require("../../controllers/shared/category.controller");
const authenticateAccessToken = require("../../middlewares/auth/verifyToken.middleware");
const allowedTo = require("../../middlewares/auth/allowedTo.middleware");
const USER_ROLES = require("../../constants/user/userRoles.constant");
const upload = require("../../middlewares/upload/imageUpload.middleware");
const { createCategoryValidator, updateCategoryValidator } = require("../../middlewares/validators/category.validator");
const requestsValidator = require("../../middlewares/validators/request.validator");

router.get("/", authenticateAccessToken, allowedTo(USER_ROLES.ADMIN), categoryController.getAllCategories);

router.post("/", authenticateAccessToken, allowedTo(USER_ROLES.ADMIN), upload(1).single("image"), createCategoryValidator, requestsValidator, categoryController.createCategory);

router.put("/:id", authenticateAccessToken, allowedTo(USER_ROLES.ADMIN), upload(1).single("image"), updateCategoryValidator, requestsValidator, categoryController.updateCategory);

router.patch("/:id/toggle", authenticateAccessToken, allowedTo(USER_ROLES.ADMIN), categoryController.toggleCategory);

router.delete("/:id", authenticateAccessToken, allowedTo(USER_ROLES.ADMIN), categoryController.deleteCategory);

module.exports=router;