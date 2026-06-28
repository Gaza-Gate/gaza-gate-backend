const router=require("express").Router();
const dashboardController=require("../controllers/dashhboard.controller")
const isauthenticated=require('../middlewares/auth/verifyToken.middleware');

router.get("/",isauthenticated,dashboardController.getSellerDashboard);

module.exports= router;