const router=require("express").Router();
const reviewController=require("../controllers/review.controller");
const isauthenticated=require('../middlewares/auth/verifyToken.middleware');

router.get("/",isauthenticated,reviewController.getSellerReviews)

module.exports=router;
