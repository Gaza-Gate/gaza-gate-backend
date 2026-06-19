const apiResponse = require("../utils/apiResponse.util.js");
const AppError=require("../utils/AppError.util.js")
const sellerService=require("../services/seller.service.js")
const productService=require("../services/product.service.js")


const getDashboard=async(req,res)=>{
    const dashboard=await sellerService.getDashboard(req.user.id)
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

   return apiResponse.sendSuccess(res,{message:"profile update successfully"},201)
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
    const products=await productService.getAllProducts(req.user.id)
    
    if(!products){
        return new AppError().fail("No product for this seller",404)
    }

    return apiResponse.sendSuccess(
        res,
        products,
        200
    )
}




const getProduct=async(req,res)=>{
    const product=await productService.getProduct(req.params.id)

    if(!product){
        return new AppError().fail("Product not found",404)
    }

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

const getOrders=async(req,res)=>{
    const orders=await sellerService.getAllOrders(req.user.id)

    return apiResponse.sendSuccess(
        res,
        orders,
        200
    )
}

const getOrder=async(req,res)=>{
    const order=await sellerService.getOrder(req.user.id,req.params.id)

    return apiResponse.sendSuccess(
        res,
        order,
        200
    )
}

const updateOrder=async(req,res)=> {
    const order=await sellerService.updateOrder(req.user.id,req.params.id)

    return apiResponse.sendSuccess(
        res,
        order,
        200
    )
}

module.exports={getSellerProfile,updateSellerProfile,updatePassword,getproducts,getProduct,createProduct,getOrders,getOrder,updateOrder}