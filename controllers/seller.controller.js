const apiResponse = require("../utils/apiResponse.util.js");
const AppError=require("../utils/AppError.util.js")
const sellerService=require("../services/seller.service.js")
const productService=require("../services/product.service.js")


const getDashboard=async(req,res)=>{
    const dashboard=await sellerService.getDashboard(req.user.id)

    return apiResponse.sendSuccess(res,
        dashboard,
        200
    )
}

const getSellerProfile=async(req,res)=>{
    const seller= await sellerService.getSellerProfile(req.user.id)

   return apiResponse.sendSuccess(
        res,
        seller,
        200
    )

}

const updateSellerProfile=async(req,res)=>{
   await sellerService.updateSellerProfile(req.user.id,req.body,req.file)

   return apiResponse.sendSuccess(res,{message:"profile update successfully"},200)
}

const updatePassword=async(req,res)=>{
    await sellerService.updatePassword(req.user.id,req.body)

    return apiResponse.sendSuccess(
        res,
        {message:"password update successfully"},
        200
    )
}

const getproducts=async(req,res)=>{
    const products=await productService.getAllProducts(req.user.id,req.query)
    
    

    return apiResponse.sendSuccess(
        res,
        products,
        200
    )
}




const getProduct=async(req,res)=>{
    const product=await productService.getProduct(req.params.productId)

    return apiResponse.sendSuccess(
        res,
        product,
        200
    )
}

const createProduct=async(req,res)=>{

    await productService.createProduct(req.user.id,req.body,req.file)


    return apiResponse.sendSuccess(
        res,
        {message:"product created successfully"},
        201
    )
}

const updateProduct=async(req,res)=>{
    const product =await productService.updateProduct(req.params.productId, req.user.id, req.body, req.file)
    
    return apiResponse.sendSuccess(res,
        product,
        200
    )
}

const deleteProduct=async(req,res)=>{
    await productService.deleteProduct(req.params.productId,req.user.id)

    return apiResponse.sendSuccess(res,
        {message:"product deleted successfully"},
        200
    )
}

const getOrders=async(req,res)=>{
    const orders=await sellerService.getAllOrders(req.user.id)

    return apiResponse.sendSuccess(
        res,
        orders,
        200
    )
}

const getOrder=async(req,res)=>{
    const order=await sellerService.getOrder(req.user.id,req.params.orderId)

    return apiResponse.sendSuccess(
        res,
        order,
        200
    )
}

const updateOrder=async(req,res)=> {
    const order=await sellerService.updateOrder(req.user.id,req.params.orderId,req.body.status)

    return apiResponse.sendSuccess(
        res,
        order,
        200
    )
}

const getReviews=async(req,res)=>{
    const reviews=await sellerService.getReviews(req.user.id,req.query)
    return apiResponse.sendSuccess(res,
        reviews,
        200
    )
}

const getNotifications=async(req,res)=>{
    const notifications=await sellerService.getNotifications(req.user.id,req.query)

    return apiResponse.sendSuccess(res,notifications,200)
}

const getNotificationState=async(req,res)=>{
    const notificationState= await sellerService.getNotificationStats(req.user.id)

    return apiResponse.sendSuccess(res,notificationState,200)
}

module.exports={getDashboard,getSellerProfile,updateSellerProfile,updatePassword,getproducts,getProduct,createProduct,updateProduct,deleteProduct,getOrders,getOrder,updateOrder,getReviews,getNotifications,getNotificationState}