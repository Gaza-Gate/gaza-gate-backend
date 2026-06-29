const { sequelize } = require("../config/db.config.js");
const { where, fn, col } = require('sequelize');
const Review=require("../models/review.model.js")
const Seller = require("../models/seller.model.js");
const Customer=require("../models/customer.model.js")
const User = require("../models/user.model.js");
const Product=require("../models/product.model.js");
const AppError = require("../utils/AppError.util.js");
const PAGINATION=require("../constants/pagination.constant.js")


const  getSellerRatingStats=async(sellerId)=>{
  const rows = await Review.findAll({
    where: { sellerId },
    attributes: [
      'rating',
      [sequelize.fn('COUNT', sequelize.col('rating')), 'count']
    ],
    group: ['rating'],
    raw: true
  });

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  
  rows.forEach(item => {
    distribution[item.rating] = parseInt(item.count);
  });


  return distribution

}

const getSellerReviews= async(userId,query)=>{
    if (!userId) throw AppError.fail("Seller authentication data is missing.", 401);
    const seller=await Seller.findOne({where:{userId},attributes:['id','rating','ratingCount']})

  const page   = Math.max(Number(query.page) || PAGINATION.DEFAULT_PAGE, 1);
  const limit  = PAGINATION.DEFAULT_LIMIT;
  const offset = (page - 1) * limit;
  
  const where={sellerId:seller.id}
  const rating=query.rating
  const parsedRating = parseInt(rating);
  
  if (!isNaN(parsedRating) && parsedRating >= 1 && parsedRating <= 5) {
    where.rating = parsedRating;
  }

  const {count,rows}=await Review.findAndCountAll({where:where,attributes:['rating','comment',['created_at', 'createdAt']],
    include:[{
    model:Customer,
    as:'customer',
    attributes:['id'],
    include:[{
      model:User,
      as:'user',
      attributes:['firstName','lastName','avatar']
    }]
  },
  {
    model:Product,
    as:'product',
    attributes:['name']}],
    order:[['created_at','DESC']],
    limit:limit,
    offset:offset,
    distinct:true})
    
    const totalPages = Math.ceil(count / limit);

    const distribution= await getSellerRatingStats(seller.id)
    
    return{
      averageRating: seller.rating ,   
      totalReviews:seller.ratingCount,
      distribution,  
      reviews:rows,
      pagination: {
        totalItems: count,
        totalPages,
        currentPage: page,
        pageSize: limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
    },
    

    }

}

module.exports={getSellerReviews};