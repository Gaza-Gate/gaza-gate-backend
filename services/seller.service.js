const { sequelize } = require("../config/db.config.js");
const { Sequelize, where } = require('sequelize');
const Seller = require("../models/seller.model.js");
const User = require("../models/user.model.js");
const Address=require('../models/address.model.js');
const Product=require("../models/product.model.js");
const AppError = require("../utils/AppError.util.js");
const Category=require("../models/category.model.js")
const Order=require("../models/order.model.js")
const OrderItem=require("../models/orderItem.model.js")
const passwordService=require("../utils/password.util.js");
const {deleteImage}=require("./image.service.js")


const getDashboard=async(userId)=>{
  const seller=await Seller.findOne({where:{userId:userId}})
  if(!seller)throw new AppError().fail("Seller not found",404);
  const completedOrder= await Order.count({ where: { sellerId: seller.id ,status:'completed'} })
  const waitingOrder= await Order.count({ where: { sellerId: seller.id, status: 'waiting' } })
  const inProgressOrder=await Order.count({ where: { sellerId: seller.id, status: 'in_progress' } })
  const activeProduct=await Product.count({where: { sellerId: seller.id, status: 'active' }})
  
  const recentOrders = await Order.findAll({
    where: { sellerId },
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

  return {
    // Stats cards
    stats: {
      completedOrder,      
      activeProduct,   
      inProgressOrder,    
      waitingOrder,      
    },

 
    recentOrders: recentOrders,         
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
    where: { sellerId: seller.id }
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
    phone:             seller.user.phone,
    avatar:            seller.user.avatar,
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

 if (file) {
    const seller = await Seller.findOne({ where: { userId }, include:[
    {
      model: User, 
      as:"user",
      attributes: ['avatar'] 
    }], });
    if (seller.user?.avatar) deleteImage(seller.user.avatar); // 🗑 delete old image
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

  if (!seller) return new AppError().fail('Seller not found', 404); 

  const totalOrder= await Order.count({ where: { sellerId: seller.id } })
  const waitingOrder= await Order.count({ where: { sellerId: seller.id, status: 'waiting' } })
  const approvedOrder=await  Order.count({ where: { sellerId: seller.id, status: 'approved' } })
  const inProgressOrder=await  Order.count({ where: { sellerId: seller.id, status: 'in_progress' } })


  const orders=await Order.findAll({where:{sellerId:seller.id}, attributes: [
      'id',
      'orderNumber',       
      'status',
      'deliveryFee',            
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
        attributes: ['quantity', 'unitPrice'],       
        include: [
          {
            model: Product,
            as: 'product',
            attributes: ['name'],
          },
        ],
      },
    ],
    order: [['createdAt', 'DESC']],

    })

  if(!orders.length){
    return new AppError().fail("No orders Found",404)
  }

  const formattedOrders = orders.map((order) => {
    const subtotal = order.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity, 0
    );
    const total = subtotal + (order.delivery ?? 0);

    return {
      id:           order.id,
      orderNumber:  order.orderNumber,                              
      customerName: `${order.customer.user.firstName} ${order.customer.user.lastName}`,
      date:         order.createdAt.toISOString().split('T')[0],   
      itemsCount:   order.items.length,                             
      totalPrice:total,                                                         
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
  if (!seller) return new AppError().fail('Seller not found', 404);
  const order=await Order.findOne({
    where:{id:orderId,sellerId:seller.id},
    attributes: [
      'id',
      'orderNumber',      
      'status',           
      'deliveryFee',     
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
            attributes: ['firstName', 'lastName', 'phone'], 
          },
          {
            model: Address,
            as: 'address',
            attributes: ['neighborhood', 'street'],       
          },
        ],
      },

      
      {
        model: OrderItem,
        as: 'items',
        attributes: ['id', 'quantity', 'unitPrice'],        
        include: [
          {
            model: Product,
            as: 'product',
            attributes: ['id', 'name', 'image'],        
          },
        ],
      },
    ],
  })

  if(!order){
    return new AppError().fail("Order not found",404)
  }

  const subtotal = order.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity, 0
  );
  const total = subtotal + (order.deliveryFee ?? 0);

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
      address: `${order.customer.address?.neighborhood} ${order.customer.address?.street}`,
    },

    items: order.items.map((item) => ({
      id:       item.id,
      name:     item.product.name,
      image:    item.product.image,
      quantity: item.quantity,
      price:    item.unitprice,
      total:    item.unitprice * item.quantity,
    })),

    subtotal:    subtotal,                                            
    deliveryFee: order.deliveryFee ?? 0,                             
    total:       total,                 
}
}
const updateOrder=async(userId,orderId,status)=>{
  const seller = await Seller.findOne({ where: { userId:userId } });
  if (!seller) throw new AppError().fail('Seller not found', 404);
  const order = await Order.findOne({
    where: { id: orderId, sellerId: seller.id }
  });
  if (!order) return new AppError().fail('Order not found', 404);

  await Order.update({status},{where:{id:orderId,sellerId:seller.id}})

  return await Order.findOne({ where: { id: orderId } });      
   
}




module.exports={getDashboard,getSellerProfile,updateSellerProfile,updatePassword,getAllOrders, getOrder, updateOrder}