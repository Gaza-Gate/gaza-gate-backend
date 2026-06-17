const express=require("express")
const isauthenticated=require('../middlewares/auth/verifyToken.middleware')
const sellerController=require("../controllers/seller.controller")
const asyncWrapper=require("../utils/asyncWrapper.util")
const filterBody = require("../middlewares/common/filterBody.middleware.js");
const sellerValidator = require("../middlewares/validators/seller.validator.js");
const requestsValidator = require("../middlewares/validators/request.validator.js");
const authorize=require("../middlewares/auth/allowedTo.middleware.js")
const upload=require("../middlewares/common/upload.js")
const router=express.Router()



router.get("/dashboard",isauthenticated,asyncWrapper(sellerController.dashboard))

// View own store and account information
router.get("/viewProfile",isauthenticated,asyncWrapper(sellerController.getSellerProfile))

//Update store and account information
router.put("/updateProfile",isauthenticated,filterBody([
    "firstName",
    "lastName",
    "phone",
    "avatar",
    "storeName",
    "storeDescription",
    "neighborhood",
  ]),sellerValidator.updateProfileValidation,requestsValidator,asyncWrapper(sellerController.updateSellerProfile))

  router.put("/updatePassword",isauthenticated,filterBody(['currentPassword','newPassword','confirmPassword'],sellerValidator.updatePasswordValidation,asyncWrapper(sellerController.updatePassword)))


// List of seller products
router.get("/Products",isauthenticated,asyncWrapper(sellerController.getproducts))

// Add product in seller store
router.post("/products",
  filterBody(["name","price","category","stockType","quantity","status","image"])
,isauthenticated,
authorize('seller'),
upload.single('image')
,sellerValidator.createProductValidation
,requestsValidator
,asyncWrapper(sellerController.createProduct))

//Get details of a single product.
router.get("/products/:productId",sellerController.getProduct)

/*Edit an existing product
( name, price, categoryId, stockType, quantity, image , status)*/
//router.put("/products/:productId")

// Permanently delete a product in seller store.
//router.delete("/products/:productId")

//List all orders for  seller's products
router.get("/orders",isauthenticated,asyncWrapper(sellerController.getOrders))

// Get  details of a specific order
router.get("/orders/:orderId",isauthenticated,asyncWrapper(sellerController.getOrder))

// update the seller's order status using the approved workflow
router.put("/orders/:orderId",isauthenticated,filterBody(['status'],sellerValidator.updateOrderStatus,asyncWrapper(sellerController.updateOrder)))

module.exports=router