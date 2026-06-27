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


// view seller dashboard
router.get("/dashboard",isauthenticated,asyncWrapper(sellerController.getDashboard))

// View own store and account information
router.get("/viewProfile",isauthenticated,asyncWrapper(sellerController.getSellerProfile))

//Update seller store and account information
router.put("/updateProfile",isauthenticated,sellerValidator.updateProfileValidation,requestsValidator,sellerController.updateSellerProfile)

router.put("/updatePassword",isauthenticated,sellerValidator.updatePasswordValidation,requestsValidator,sellerController.updatePassword)


// List of seller products
router.get("/products",isauthenticated,asyncWrapper(sellerController.getproducts))

// Add product in seller store
router.post("/products",
isauthenticated,
upload.single('image'),
filterBody(["name","price","category","stockType","quantity","status","image"]),
sellerValidator.createProductValidation
,requestsValidator
,asyncWrapper(sellerController.createProduct))

//Get details of a single product.
router.get("/products/:productId", isauthenticated, asyncWrapper(sellerController.getProduct))

/*Edit an existing product
( name, price, categoryId, stockType, quantity, image , status)*/
router.put("/products/:productId",
  isauthenticated,
  upload.single('image'),   // string, not variable
  filterBody(["name","price","category","stockType","quantity","status"]),
  sellerValidator.updateProductValidation,
  requestsValidator,
  asyncWrapper(sellerController.updateProduct)
)

// Permanently delete a product in seller store.
router.delete("/products/:productId",isauthenticated,asyncWrapper(sellerController.deleteProduct))

//List all orders for  seller's products
router.get("/orders",isauthenticated,asyncWrapper(sellerController.getOrders))

// Get  details of a specific order
router.get("/orders/:orderId",isauthenticated,asyncWrapper(sellerController.getOrder))

// update the seller's order status 
router.put("/orders/:orderId",isauthenticated,filterBody(['status']),sellerValidator.updateOrderStatus,requestsValidator,asyncWrapper(sellerController.updateOrder))

router.get("/reviews",isauthenticated,asyncWrapper(sellerController.getReviews))

router.get("/notifications",isauthenticated,asyncWrapper(sellerController.getNotifications))

router.get("/notificationState",isauthenticated,asyncWrapper(sellerController.getNotificationState))

module.exports=router