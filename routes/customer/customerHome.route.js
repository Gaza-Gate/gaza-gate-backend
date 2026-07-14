const router = require("express").Router();
const customerHomeController = require("../../controllers/customer/customerHome.controller");

router.get("/", customerHomeController.getHomePage);

module.exports = router;
