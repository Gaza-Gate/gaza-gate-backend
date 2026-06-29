const express=require("express")
const isauthenticated=require('../middlewares/auth/verifyToken.middleware')
const {updateProfileValidation,updatePasswordValidation} = require("../middlewares/validators/profile.validator.js");
const requestsValidator = require("../middlewares/validators/request.validator.js");
const profileController=require("../controllers/profile.controller.js")
const upload=require("../middlewares/upload/imageUpload.middlewares.js")
const router=express.Router()


router.get("/",isauthenticated,profileController.getSellerProfile)

router.put("/",isauthenticated,
    upload(1).single("avatar"),
    updateProfileValidation,requestsValidator
    ,profileController.updateSellerProfile)

router.put("/changePassword",isauthenticated,updatePasswordValidation,requestsValidator,profileController.updatePassword)

module.exports=router