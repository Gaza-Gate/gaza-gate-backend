const apiResponse = require("../utils/apiResponse.util.js");
const asyncWrapper=require("../utils/asyncWrapper.util.js")
const profileService=require("../services/profile.service")

const getSellerProfile=asyncWrapper(async(req,res)=>{
    const profile= await profileService.getSellerProfile(req.user.id)

   return apiResponse.sendSuccess(
        res,
        {profile},
        200
    )
});

const updateSellerProfile=asyncWrapper(async(req,res)=>{
   await profileService.updateSellerProfile(req.user.id,req.body,req.file.buffer)

   return apiResponse.sendSuccess(res,{message:"profile update successfully"},200)
});

const updatePassword=asyncWrapper(async(req,res)=>{
    await profileService.updatePassword(req.user.id,req.body)

    return apiResponse.sendSuccess(
        res,
        {message:"password update successfully"},
        200
    )
});

module.exports={getSellerProfile,updateSellerProfile,updatePassword}