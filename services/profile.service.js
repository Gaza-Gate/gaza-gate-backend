const { sequelize } = require("../config/db.config.js");
const { Sequelize, where, fn, col } = require('sequelize');
const Seller = require("../models/seller.model.js");
const User = require("../models/user.model.js");
const UserStatus=require("../constants/userStatus.constant.js")
const Address=require('../models/address.model.js');
const AppError = require("../utils/AppError.util.js");
const Order=require("../models/order.model.js");
const passwordService=require("../utils/password.util.js");
const cloudinaryService=require("./cloudinary.service.js")
const ORDER_STATUSES = require("../constants/orderStatuses.constant.js");

const getSellerProfile= async(userId)=>{
    const seller= await Seller.findOne({
      where:{userId:userId},
      attributes:['id','storeName','storeDescription','rating',['created_at','createdAt']],
         include: [
            {
              model: User, 
              as:"user",
              attributes: ['firstName','lastName','email','phone','avatar','status','passwordChangedAt'] 
             }
            ],
    });

    if (!seller) {
      throw AppError.fail("No account found.", 404);
    }
    const address=await Address.findOne({where:{userId:userId},attributes:['neighborhood','street','notes']})
   
    const totalOrders = await Order.count({     
    where: { sellerId:seller.id,status: ORDER_STATUSES.COMPLETED }
   });
    const memberSince = new Date(seller.dataValues.createdAt);
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
    memberSince:       memberSince.toISOString().split('T')[0],
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
  const userFields = ['firstName', 'lastName', 'phone', 'avatar'];
  const addressFields = ['neighborhood', 'street', 'notes']

  const sellerData = {};
  const userData = {};
  const addressData = {};

  if (data.email) throw AppError.fail('Email cannot be updated', 400);

  for (const key in data) {
    if (sellerFields.includes(key)) sellerData[key] = data[key];
    if (userFields.includes(key)) userData[key] = data[key];
    if (addressFields.includes(key)) addressData[key] = data[key]
  }
  const folder=`avatars/${userId}`
  let uploadedImage=null;
  let oldAvatarPublicId = null;
  if (file) {
     uploadedImage = await cloudinaryService.uploadImage(file.buffer, folder);
    const existingUser = await User.findOne({
      where: { id: userId },
      attributes: ['avatar','publicId'],
    });
    oldAvatarPublicId = existingUser?.publicId ?? null;
    userData.avatar = uploadedImage.url;
    userData.publicId=uploadedImage.publicId
  }

const transaction = await sequelize.transaction();

try {
  if (Object.keys(sellerData).length > 0) {
      await Seller.update(sellerData, {
        where: { userId: userId },
        transaction
      });
    }

    if (Object.keys(userData).length > 0) {
      await User.update(userData, {
        where: { id: userId },
        transaction
      });
    }

    if (Object.keys(addressData).length > 0) {
      const address = await Address.findOne({ where: { userId: userId } });
      
      if (!address) {
        await Address.create({
          userId: userId, 
          ...addressData
        }, { transaction });
      } else {
        await Address.update(addressData, {
          where: { userId: userId },
          transaction
        });
      }
    }

  await transaction.commit();

  if (file && oldAvatarPublicId) cloudinaryService.deleteImage(oldAvatarPublicId);
} catch (error) {
 
  await transaction.rollback();
  if (uploadedImage?.publicId) {
    await cloudinaryService.deleteImage(uploadedImage.publicId);
    }
  throw error;
}
}


const updatePassword= async(userId,data)=> {
  const user=await User.findOne({where:{id:userId},attributes:['id', 'password', 'passwordChangedAt']})
  
  if (!user) throw  AppError.fail("user not found",404);
  
  const isEquel=await passwordService.comparePassword(data.currentPassword,user.password);
  
  if(!isEquel) throw  AppError.fail("Current password is incorrect",400);
  const isSame = await passwordService.comparePassword(
    data.newPassword,
    user.password
  );

  if(data.newPassword !== data.confirmPassword) throw new AppError.fail("Password not match",400);
  
  if (isSame) throw AppError.fail('New password must be different from current password', 400);
  
  user.password=await passwordService.hashPassword(data.newPassword)
  user.passwordChangedAt= new Date();

  await user.save();

}

module.exports={getSellerProfile,updateSellerProfile,updatePassword};