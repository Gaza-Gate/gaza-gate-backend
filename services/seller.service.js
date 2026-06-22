const { sequelize } = require("../config/db.config.js");
const { Sequelize, where } = require('sequelize');
const Seller = require("../models/seller.model.js");
const User = require("../models/user.model.js");
const UserStatus=require("../constants/userStatus.constant.js")
const Address=require('../models/address.model.js');
const Product=require("../models/product.model.js");
const AppError = require("../utils/AppError.util.js");
const Category=require("../models/category.model.js")
const Customer=require("../models/customer.model.js")
const Order=require("../models/order.model.js")
const OrderItem=require("../models/orderItem.model.js")
const ORDER_STATUSES=require("../constants/orderStatuses.constant.js")
const Review=require("../models/review.model.js")
const passwordService=require("../utils/password.util.js");
const {deleteImage}=require("./image.service.js");
const Conversation = require("../models/conversation.model.js");
const Message=require("../models/message.model.js")
const TRANSITIONS=require("../constants/transitionsStatus.constant.js")


const getDashboard=async(userId)=>{
  const seller=await Seller.findOne({where:{userId:userId},attributes:['id','rating','ratingCount']})
  if(!seller)throw new AppError().fail("Seller not found",404);
  
   const [completedOrder, waitingOrder, inProgressOrder, activeProduct] = await Promise.all([
    Order.count({ where: { sellerId: seller.id, status: ORDER_STATUSES.COMPLETED } }),
    Order.count({ where: { sellerId: seller.id, status: ORDER_STATUSES.PENDING_REVIEW } }),
    Order.count({ where: { sellerId: seller.id, status: ORDER_STATUSES.IN_PRODUCTION } }),
    Product.count({ where: { sellerId: seller.id, status: UserStatus.ACTIVE } }),
  ]);
   const reviews=await Review.findAll({where:{sellerId:seller.id},
    attributes:['rating','comment','createdAt'],
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

 const [fiveRating, fourRating, threeRating, twoRating, oneRating] = await Promise.all([
    Review.count({ where: { sellerId: seller.id, rating: 5 } }),
    Review.count({ where: { sellerId: seller.id, rating: 4 } }),
    Review.count({ where: { sellerId: seller.id, rating: 3 } }),
    Review.count({ where: { sellerId: seller.id, rating: 2 } }),
    Review.count({ where: { sellerId: seller.id, rating: 1 } }),
  ]);


  const formattedReviews = reviews.map((r) => ({
    customerName: `${r.customer.user.firstName} ${r.customer.user.lastName}`,
    avatar:       r.customer.user.avatar,
    rating:       r.rating,
    comment:      r.comment,
    date:         r.createdAt.toISOString().split('T')[0],
  }));

  const conversations = await Conversation.findAll({
  where: { sellerId: seller.id },
  attributes: ['id', 'lastMessageAt'],
  include: [
    {
      model: User,
      as: 'customer',
      attributes: ['id', 'firstName', 'lastName', 'avatar'],
    },
  ],
  order: [['lastMessageAt', 'DESC']],
  limit: 3,
});


const conversationsWithLastMessage = await Promise.all(
  conversations.map(async (c) => {
    const lastMessage = await Message.findOne({
      where: { conversationId: c.id },
      attributes: ['id', 'content', 'senderId', 'createdAt'],
      order: [['createdAt', 'DESC']],
    });
     return {
      conversationId: c.id,
      customerName:   `${c.customer.user.firstName} ${c.customer.user.lastName}`,
      avatar:         c.customer.avatar,
      preview:        lastMessage?.content ?? '',
      isFromCustomer: lastMessage ? lastMessage.senderId === c.customer.id : false,
      time:          c.lastMessageAt,
    };
  })
);
    
  
   const recentOrders = await Order.findAll({
    where: { sellerId:seller.id },
    attributes: ['id', 'orderNumber', 'status', 'totalPrice', 'createdAt'],
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
    order: [['createdAt', 'DESC']],
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
      distribution: {fiveRating,fourRating,threeRating,twoRating,oneRating},          
      reviews:      formattedReviews,           
    },

    messages: {
      list:conversationsWithLastMessage ,         
    },


 
    recentOrders:formattedRecentOrders,         
  };



  
}

const getSellerProfile= async(userId)=>{
    const seller= await Seller.findOne({
        where:{userId:userId},
         include: [
    {
      model: User, 
      as:"user",
      attributes: ['firstName','lastName','email','phone','avatar','status','passwordChangedAt'] 
    }

  ],
        attributes:['storeName','storeDescription','rating','createdAt']
    })

    if (!seller) {
      throw AppError.fail("No account found.", 404);
    }
    const address=await Address.findOne({where:{userId:userId},attributes:['neighborhood','street','notes']})
   
    const totalOrders = await Order.count({     
    where: { sellerId: seller.id,status: 'completed'  }
   });

    const memberSince = new Date(seller.createdAt);
    const now = new Date();
    const membershipMonths =
    (now.getFullYear() - memberSince.getFullYear()) * 12 +
    (now.getMonth() - memberSince.getMonth());

    const passwordUpdatedAt = seller.user.passwordChangedAt
    ? new Date(seller.user.passwordChangedAt)
    : null;

  const passwordMonthsAgo = passwordUpdatedAt
    ? (now.getFullYear() - passwordUpdatedAt.getFullYear()) * 12 +
      (now.getMonth() - passwordUpdatedAt.getMonth())
    : null; 

    return {
    storeName:         seller.storeName,
    storeDescription:  seller.storeDescription,
    rating:            seller.rating,
    status:            seller.user.status,
    memberSince:       memberSince,
    membershipMonths:  membershipMonths,
    firstName:         seller.user.firstName,
    lastName:          seller.user.lastName,
    email:             seller.user.email,
    phone:             seller.user?.phone,
    avatar:            seller.user?.avatar,
    address: address
      ? `${address.neighborhood} ${address.street}`  
      : null,
    neighborhood:      address?.neighborhood,
    street:            address?.street,
    notes:             address?.notes,
    totalOrders:       totalOrders,
    passwordMonthsAgo: passwordMonthsAgo,
  };
}

const updateSellerProfile= async(userId,data,file)=>{
const sellerFields = ['storeName', 'storeDescription'];
const userFields = ['firstName', 'lastName','phone', 'avatar'];
const addressFields=['neighborhood','street','notes']

const sellerData = {};
const userData = {};
const addressData={};

if (data.email) throw AppError.fail('Email cannot be updated', 400);

for (const key in data) {
  if (sellerFields.includes(key)) sellerData[key] = data[key];
  if (userFields.includes(key)) userData[key] = data[key];
  if(addressFields.includes(key)) addressData[key]=data[key]
}

 let oldAvatar = null;
  if (file) {
    const existingUser = await User.findOne({
      where: { id: userId },
      attributes: ['avatar'],
    });
    oldAvatar = existingUser?.avatar ?? null;
    userData.avatar = file.filename;
  }

const transaction = await sequelize.transaction();

try {
  await Seller.update(sellerData, {
    where: { userId: userId },
    transaction
  });

  await User.update(userData, {
    where: { id: userId }, 
    transaction
  });
  const address = await Address.findOne({where:{userId:userId}})
  if(!address){
    await Address.create({
      userId:userId,...addressData},{transaction}) 
  }else{
    await Address.update(addressData,{
    where:{userId:userId},
    transaction
  })
  }

  await transaction.commit();

  if (file && oldAvatar) deleteImage(oldAvatar);
} catch (error) {
 
  await transaction.rollback();
  if (file) deleteImage(file.filename);
  throw error;
}
}


const updatePassword= async(userId,data)=> {
  const user=await User.findOne({where:{id:userId}})
  if (!user)throw new AppError().fail("user not found",404);
  const isEquel=await passwordService.comparePassword(data.currentPassword,user.password);
  if(!isEquel) throw new AppError().fail("Current password is incorrect",400);
  const isSame = await passwordService.comparePassword(
    data.newPassword,
    user.password
  );
  if (isSame) throw AppError.fail('New password must be different from current password', 400);

   
  if(data.newPassword !== data.confirmPassword) throw new AppError().fail("Password not match",400)
  
  user.password=await passwordService.hashPassword(data.newPassword)
  user.passwordChangedAt= new Date()

  await user.save()
  

}


const getAllOrders=async(userId)=>{
  const seller=await Seller.findOne({
    where:{userId:userId}
  })

  if (!seller) throw new AppError().fail('Seller not found', 404); 

  const [totalOrder, waitingOrder,approvedOrder, inProgressOrder] = await Promise.all([
    Order.count({ where: { sellerId: seller.id} }),
    Order.count({ where: { sellerId: seller.id, status: ORDER_STATUSES.PENDING_REVIEW } }),
    Order.count({ where: { sellerId: seller.id, status: ORDER_STATUSES.ACCEPTED } }),
    Order.count({ where: { sellerId: seller.id, status: ORDER_STATUSES.IN_PRODUCTION } }),
  ]);


  const orders=await Order.findAll({where:{sellerId:seller.id}, attributes: [
      'id',
      'orderNumber',       
      'status',       
      'totalPrice',      
      'createdAt',         
    ],
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
      {
        model: OrderItem,
        as: 'items',
        attributes: ['quantity'],       
      },
    ],
    order: [['createdAt', 'DESC']],

    })

  if(!orders.length){
    throw new AppError().fail("No orders Found",404)
  }

  const formattedOrders = orders.map((order) => {
    return {
      id:           order.id,
      orderNumber:  order.orderNumber,                              
      customerName: `${order.customer.user.firstName} ${order.customer.user.lastName}`,
      date:         order.createdAt.toISOString().split('T')[0],   
      itemsCount:   order.items.length,                             
      totalPrice:order.totalPrice,                                                         
      status:       order.status,                                    
    };
  });

  return {
   
    stats: {
      totalOrder,                                                          
      waitingOrder,                                                        
      approvedOrder,                                                       
      inProgressOrder,                                                   
    },
    orders: formattedOrders,
  };

}

const getOrder=async(userId,orderId)=>{
  const seller = await Seller.findOne({ where: { userId:userId } });
  if (!seller) throw new AppError().fail('Seller not found', 404);
  const order=await Order.findOne({
    where:{id:orderId,sellerId:seller.id},
    attributes: [
      'id',
      'orderNumber',      
      'status',
      'totalPrice',
      'subtotal',
      'shippingNeighborhood',
      'shippingStreet',           
      'shippingFee',     
      'createdAt',         
    ],
    include: [
      {
        model: Customer,
        as: 'customer',
        attributes: ['id'],
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id','firstName', 'lastName', 'phone'], 
          },
        ],
      }, 
      {
        model: OrderItem,
        as: 'items',
        attributes: ['id', 'quantity', 'unitPrice','lineTotal','productName','productImage'],        
      },
    ],
  })

  if(!order)throw new AppError().fail("Order not found",404)
  const createdAt  = new Date(order.createdAt);
  const orderDate  = createdAt.toISOString().split('T')[0];          
  const orderTime  = createdAt.toTimeString().slice(0, 5);          

  return {
    id:           order.id,
    orderNumber:  order.orderNumber,                                  
    status:       order.status,
    orderDate,                                                       
    orderTime,                                                        
    itemsCount:   order.items.length, 
    
    customer: {
      name:    `${order.customer.user.firstName} ${order.customer.user.lastName}`,
      phone:   order.customer.user.phone,
      address: `${order.shippingNeighborhood ?? ''} ${order.shippingStreet ?? ''}`,
    },

    items: order.items.map((item) => ({
      id:       item.id,
      name:     item.productName,
      image:    item.productImage,
      quantity: item.quantity,
      price:    item.unitPrice,
      total:   item.lineTotal,
    })),

    subtotal:order.subtotal,                                            
    shippingFee: order.shippingFee ,                             
    total:order.totalPrice,                 
}
}
const updateOrder=async(userId,orderId,status)=>{
  const seller = await Seller.findOne({ where: { userId:userId } });
  if (!seller) throw new AppError().fail('Seller not found', 404);
  const order = await Order.findOne({
    where: { id: orderId, sellerId: seller.id }
  });
  if (!order) throw new AppError().fail('Order not found', 404);

  const allowedNextStatuses = TRANSITIONS[order.status] ?? [];
 
  if (allowedNextStatuses.length === 0) {
    throw AppError.fail(
      `Order is already in a final state ("${order.status}") and cannot be updated further`,
      400
    );
  }
 
  if (!allowedNextStatuses.includes(status)) {
    throw AppError.fail(
      `Invalid transition: "${order.status}"`,
      400
    );
  }

 order.status=status
 await order.save()

  return order;      
   
}




module.exports={getDashboard,getSellerProfile,updateSellerProfile,updatePassword,getAllOrders, getOrder, updateOrder}