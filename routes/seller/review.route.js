const router = require("express").Router();
const reviewController = require("../../controllers/seller/review.controller");
const authenticateAccessToken = require("../../middlewares/auth/verifyToken.middleware");

router.get("/", authenticateAccessToken, reviewController.getSellerReviews);

module.exports = router;
