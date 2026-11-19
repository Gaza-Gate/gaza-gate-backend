const router = require("express").Router();
const landingController = require("../../controllers/shared/landing.controller.js");

router.get("/", landingController.getLandingState);

module.exports = router;