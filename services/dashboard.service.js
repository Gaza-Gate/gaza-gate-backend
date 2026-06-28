const { sequelize } = require("../config/db.config.js");
const { Sequelize, where, fn, col } = require('sequelize');
const Seller = require("../models/seller.model.js");
const Customer=require("../models/customer.model.js")
const User = require("../models/user.model.js");
const UserStatus=require("../constants/userStatus.constant.js")
const Review=require("../models/review.model.js")
const Product=require("../models/product.model.js")
const Address=require('../models/address.model.js');
const AppError = require("../utils/AppError.util.js");
const Order=require("../models/order.model.js");
const ORDER_STATUSES = require("../constants/orderStatuses.constant.js");

const getDashboard=async(userId)=>{
  const seller=await Seller.findOne({where:{userId:userId},attributes:['id','rating','ratingCount']})
  if(!seller)throw new AppError.fail("Seller not found",404);
  
   const [completedOrder, waitingOrder, inProgressOrder, activeProduct] = await Promise.all([
    Order.count({ where: { sellerId: seller.id, status: ORDER_STATUSES.COMPLETED } }),
    Order.count({ where: { sellerId: seller.id, status: ORDER_STATUSES.PENDING_REVIEW } }),
    Order.count({ where: { sellerId: seller.id, status: ORDER_STATUSES.IN_PRODUCTION } }),
    Product.count({ where: { sellerId: seller.id, status: UserStatus.ACTIVE } }),
  ]);
   const reviews=await Review.findAll({where:{sellerId:seller.id},
    attributes:['rating','comment',['created_at','createdAt']],
    include:[{
      model:Customer,
      as:'customer',
      attributes: ['id'],
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['firstName', 'lastName', 'avatar'],
          },
        ],
      },
    ],
    order: [['createdAt', 'DESC']],
    limit: 3,            
  });

 const distributionRating = await Review.findAll({
    where: { sellerId: seller.id },
    attributes: [
      'rating',
      [sequelize.fn('COUNT',col('rating')), 'count']
    ],
    group: ['rating'],
    raw: true
  });

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  
  distributionRating.forEach(item => {
    distribution[item.rating] = parseInt(item.count);
  });

  const formattedReviews = reviews.map((r) => ({
    customerName: `${r.customer.user.firstName} ${r.customer.user.lastName}`,
    avatar:       r.customer.user.avatar,
    rating:       r.rating,
    comment:      r.comment,
    date:         r.dataValues.createdAt.toISOString().split('T')[0],
  }));


  
   const recentOrders = await Order.findAll({
    where: { sellerId:seller.id },
    attributes: ['id', 'orderNumber', 'status', 'totalPrice', ['created_at','createdAt']],
    include: [
      {
        model: Customer,
        as: 'customer',
        attributes: ['id'],
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['firstName', 'lastName'],
          },
        ],
      },
    ],
    order: [['created_at', 'DESC']],
    limit: 3,              
  });

  const formattedRecentOrders = recentOrders.map((order) => {
    return {
      id:           order.id,
      orderNumber:  order.orderNumber,                              
      customerName: `${order.customer.user.firstName} ${order.customer.user.lastName}`,
      status:       order.status,                                  
      total:order.totalPrice,                                                      
    };
  });

  return {
    stats: {
      completedOrder,      
      activeProduct,   
      inProgressOrder,    
      waitingOrder,      
    },
     rating: {
      average:     seller.rating ,   
      totalReviews:seller.ratingCount,                              
      distribution: distribution,          
      reviews:      formattedReviews,           
    },

 
    recentOrders:formattedRecentOrders,         
  };

}

module.exports={getDashboard}