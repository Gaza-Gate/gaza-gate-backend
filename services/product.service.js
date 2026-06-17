const { Sequelize, where } = require('sequelize');
const Seller = require("../models/seller.model.js");
const User = require("../models/user.model.js");
const Product=require("../models/product.model.js");
const AppError = require("../utils/AppError.util.js");
const Category=require("../models/category.model.js")
const {deleteImage}=require("./image.service.js")

const getAllProducts=async(userId)=>{
  const seller=await Seller.findOne({where:{userId:userId}})

  const products= await Product.findAll({where:{sellerId:seller.id},
    include:[{
        model:Category,
        as:'category',
        attributes:['name']
    }],
    attributes:['id','name','price','image','quantity','status'],
});

if (!products.length){
  throw new AppError().fail("No products yet",404)
}

return {
    id:products.id,
    name:products.name,
    price:products.price,
    image:products.image,
    quantity:products.quantity,
    status:products.status,
    category:products.category.name
};

}

const getProduct=async(productId)=>{
    const product=await Product.findOne({where:{id:productId},include:[
        {
            model:Category,
            as:"category",
            attributes:['name']
        },  
     ],
   attributes:['name','description','price','quantity','image','status']
  })

  return product
}

const createProduct=async(userId,data,file)=>{
  const seller=await Seller.findOne({where:{userId:userId}})
  
  
  if (!seller) throw new AppError().fail('Seller not found',404);

  const productData={sellerId:seller.id ,image:file.filename, ...data}

  await Product.create(productData)


}


module.exports={getAllProducts,getProduct,createProduct}