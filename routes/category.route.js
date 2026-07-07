const router = require("express").Router();
const controller = require("../controllers/category.controller.js");
const upload = require("../middlewares/upload/imageUpload.middleware.js");
const authenticateAccessToken = require("../middlewares/auth/verifyToken.middleware.js");
const {
  createCategoryValidator,
  updateCategoryValidator,
} = require("../middlewares/validators/category.validator.js");
const requestsValidator = require("../middlewares/validators/request.validator.js");

router.get("/", authenticateAccessToken, controller.getAllCategories);
router.get("/all", authenticateAccessToken, controller.getAllCategoriesList);
router.get("/:id", authenticateAccessToken, controller.getCategory);

router.post(
  "/",
  authenticateAccessToken,
  upload(1).single("image"),
  createCategoryValidator,
  requestsValidator,
  controller.createCategory,
);

router.put(
  "/:id",
  authenticateAccessToken,
  upload(1).single("image"),
  updateCategoryValidator,
  requestsValidator,
  controller.updateCategory,
);

router.patch("/:id/toggle", authenticateAccessToken, controller.toggleCategory);

router.delete("/:id", authenticateAccessToken, controller.deleteCategory);

module.exports = router;
