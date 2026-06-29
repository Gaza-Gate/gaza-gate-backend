const {Op,fn,col}= require("sequelize")
const User=require("../models/user.model")
const Notification=require("../models/notification.model")
const Order=require("../models/order.model")
const UserNotification=require("../models/userNotification.model")
const PAGINATION=require("../constants/pagination.constant")
const NOTIFICATION_TYPES=require("../constants/notificationTypes.constant")


const getNotificationStats=async(userId)=>{
 
    const rows = await Notification.findAll({
    attributes:['type'
      ,[fn('COUNT',col('Notification.id')),'count']],
     include: [{
    model: User,
    as: 'recipients',
    where: { id: userId },
    attributes: [],
    through: { attributes: [] }}],
    group:['Notification.type'],
    raw:true
  });

  const unReadCount = await UserNotification.count({
      where: { userId, isRead: false }
    });

  const map = rows.reduce((acc, row) => {
    acc[row.type] = parseInt(row.count);
    return acc;
  }, {});

  return {
    total: Object.values(map).reduce((s, c) => s + c, 0),
    order: map[NOTIFICATION_TYPES.ORDER] || 0,
    system: map[NOTIFICATION_TYPES.SYSTEM] || 0,
    product: map[NOTIFICATION_TYPES.PRODUCT] || 0,
    review: map[NOTIFICATION_TYPES.REVIEW] || 0,
    unRead:unReadCount

  };
};



const getNotifications=async(userId,query)=>{
  if (!userId) throw AppError.fail("Seller authentication data is missing.", 401);

  const page   = Math.max(Number(query.page) || PAGINATION.DEFAULT_PAGE, 1);
  const limit  = PAGINATION.DEFAULT_LIMIT;
  const offset = (page - 1) * limit;
  const type= query.type
 

  const notificationWhere = {};
  if (type) notificationWhere.type = type;

   // Fix: Destructure the array returned by Promise.all
  const [{ count, rows }, stats] = await Promise.all([
    Notification.findAndCountAll({
      include: [
      {
        model: User,
        as: 'recipients',
        where: { id: userId },
        attributes: [],           
        through: {
          attributes: [],  
        },
      },
      {
        model: User,
        as: 'sender',
        attributes: ['id', 'firstName', 'lastName', 'avatar'],
        required: false,
      },
      {
        model: Order,
        as: 'order',
        attributes: ['id', 'orderNumber', 'status'],
        required: false,
      },
    ],
    where: notificationWhere,

    order: [['sentAt', 'DESC']], 
    limit,
    offset,
    distinct: true,
  }),
  getNotificationStats(userId)
]);
  

  const totalPages = Math.ceil(count / limit);

  const notifications =  await Promise.all(rows.map(async(n) =>{
    const userNotifications = await UserNotification.findOne({
    where: {
      userId,
      notificationId:n.id,
    },
    attributes: ['notificationId', 'isRead'],
  });
    return {
    id: n.id,
    type: n.type,
    title: n.title,
    content: n.content,
    actionUrl: n.actionUrl,
    isRead:userNotifications.isRead ?? false,
    sentAt: n.sentAt,
    sender: n.sender
      ? {
          id: n.sender.id,
          name: `${n.sender.firstName} ${n.sender.lastName}`.trim(),
        }
      : null,
    order: n.order
      ? {
          id: n.order.id,
          orderNumber: n.order.orderNumber,
          status: n.order.status,
        }
      : null,
  };
  })
)
  return {
    notifications,
    stats,
    pagination: {
      currentPage:     parseInt(page),
      totalPages,                          
      totalItems:      count,
      pageSize:        limit,
      hasNextPage:     parseInt(page) < totalPages,   
      hasPreviousPage: parseInt(page) > 1,
    },
  };
  };

  const markAllAsRead=async(userId)=>{
    const [readedCount] = await UserNotification.update(
    { isRead: true },
    { where: { userId, isRead: false } }   
  );
  
  return  readedCount ;
  }

const markAsRead=async(userId,notificationId)=>{
    const userNotification = await UserNotification.findOne({
    where: { userId, notificationId },
  });
 
  if (!userNotification) throw AppError.fail('Notification not found', 404);
 
  if (userNotification.isRead) return { alreadyRead: true };
 
  userNotification.isRead = true;
  await userNotification.save();
 
  return  userNotification ;
}

const deleteAllNotifications = async (userId) => {
    const deletedCount = await UserNotification.destroy({
        where: { userId },
  });
  
  return deletedCount ;
};

module.exports={getNotifications,markAllAsRead,markAsRead,deleteAllNotifications}