const { Sequelize, where,Op } = require('sequelize');
const Seller = require("../models/seller.model.js");
const User = require("../models/user.model.js");
const Product=require("../models/product.model.js");
const AppError = require("../utils/AppError.util.js");
const Category=require("../models/category.model.js")
const {deleteImage,getImageUrl}=require("./image.service.js")

const getAllProducts=async(userId,query)=>{
  const seller=await Seller.findOne({where:{userId:userId}})
  const{search}=query

  const where = { sellerId: seller.id };
 
  if (search && search.trim() !== '') {
    where.name = { [Op.like]: `%${search.trim()}%` };
  }


  const products= await Product.findAll({
    where,
    attributes: [
      'id',
      'name',        
      'price',       
      'quantity',    
      'stockType',  
      'status',      
      'image',       
    ],
    include:[{
        model:Category,
        as:'category',
        attributes:['id','name']
    }],
   order: [['createdAt', 'DESC']],
});

if (!products.length){
  throw new AppError().fail("No products yet",404)
}

return products.map((p) => ({
    id:           p.id,
    name:         p.name,
    price:        p.price,
    quantity:     p.stockType === 'limited' ? p.quantity : null,
    stockType:    p.stockType,
    status:       p.status,
    image:        getImageUrl(p.image), 
    category: {
      id:   p.category.id,
      name: p.category.name,
    },
  }));
}

const getProduct=async(productId)=>{
    const product=await Product.findOne({where:{id:productId},include:[
        {
            model:Category,
            as:"category",
            attributes:['id','name']
        },  
     ],
   attributes:['id','name','description','price', 'stockType','quantity','image','status']
  })

  return{ ...product,
    image:getImageUrl(product.image)
};
}

const createProduct=async(userId,data,file)=>{
  const seller=await Seller.findOne({where:{userId:userId}})
  
  if (!seller) throw new AppError().fail('Seller not found',404);

 const product = await Product.create({
    name:       data.name,
    price:      data.price,
    stockType:  data.stockType,
    quantity:   data.stockType === 'limited' ? data.quantity : null,
    status:     data.status,
    image:      file.filename,
    categoryId: category.id,
    sellerId:   seller.id,
  });


}

const updateProduct = async (productId, userId, data, file) => {}

const deleteProduct = async (productId, userId) => {
  const seller = await Seller.findOne({ where: { userId } });
  if (!seller) throw AppError.fail('Seller not found', 404);
 
  const product = await Product.findOne({
    where: { id: productId, sellerId: seller.id },
  });
  if (!product) throw AppError.fail('Product not found', 404);
 
  const imageToDelete = product.image;
  await product.destroy();
  deleteImage(imageToDelete);        
};



module.exports={getAllProducts,getProduct,createProduct}