const router = require("express").Router();
const controller = require("../../controllers/shared/category.controller.js");
const upload = require("../../middlewares/upload/imageUpload.middleware.js");
const authenticateAccessToken = require("../../middlewares/auth/verifyToken.middleware.js");
const {
  createCategoryValidator,
  updateCategoryValidator,
} = require("../../middlewares/validators/category.validator.js");
const requestsValidator = require("../../middlewares/validators/request.validator.js");

router.get("/", authenticateAccessToken, controller.getAllCategories);
router.get("/all", authenticateAccessToken, controller.getAllCategoriesList);
router.get("/:id", authenticateAccessToken, controller.getCategory);


module.exports = router;
