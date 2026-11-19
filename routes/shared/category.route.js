const router = require("express").Router();
const controller = require("../../controllers/shared/category.controller.js");
const optionalAuthenticateAccessToken = require("../../middlewares/auth/optionalAuthenticate.middleware.js");

router.get("/", optionalAuthenticateAccessToken, controller.getAllCategories);
router.get(
  "/all",
  optionalAuthenticateAccessToken,
  controller.getAllCategoriesList,
);
router.get("/:id", optionalAuthenticateAccessToken, controller.getCategory);

module.exports = router;
