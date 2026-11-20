const router = require("express").Router();
const storePageController = require("../../controllers/shared/storePage.controller.js");

// Mounted at "/store" (not under /api): serves gazagate.store/store/<slug-or-id>
// as the frontend app + link-preview tags. Any key is accepted — unknown
// stores get the plain app page (the React app shows its own "not found").
router.get("/:storeKey", storePageController.getStorePage);

module.exports = router;
