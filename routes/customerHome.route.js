const router = require("express").Router();
const customerHomeController = require("../controllers/customerHome.controller");

router.get("/", customerHomeController.getHomePage);

module.exports = router;
