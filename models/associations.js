const User = require("./user.model");
const Role = require("./role.model");
const Address = require("./address.model");
const Customer = require("./customer.model");
const Seller = require("./seller.model");
const RefreshToken = require("./refreshToken.model");
const PasswordResetSession = require("./passwordResetSession.model.js");
const UserAuthProvider = require("./UserAuthProvider.model.js");
const EmailVerification = require("./emailVerification.model.js");
const Category = require("./category.model.js");
const Product = require("./product.model.js");
const ProductImage = require("./productImage.model.js");
const Wishlist = require("./wishlist.model.js");
const Cart = require("./cart.model.js");
const CartItem = require("./cartItem.model.js");
const Order = require("./order.model.js");
const OrderItem = require("./orderItem.model.js");
const Notification = require("./notification.model.js");
const UserNotification = require("./userNotification.model.js");
const Review = require("./review.model.js");
const Conversation = require("./conversation.model.js");
const Message = require("./message.model.js");

// ==================== AUTH ====================

Role.hasMany(User, {
  foreignKey: { name: "roleId", field: "role_id" },
  as: "users",
  onDelete: "RESTRICT",
  onUpdate: "CASCADE",
});
User.belongsTo(Role, {
  foreignKey: { name: "roleId", field: "role_id" },
  as: "role",
  onDelete: "RESTRICT",
  onUpdate: "CASCADE",
});

User.hasMany(Address, {
  foreignKey: { name: "userId", field: "user_id" },
  as: "addresses",
  onDelete: "CASCADE",
});
Address.belongsTo(User, {
  foreignKey: { name: "userId", field: "user_id" },
  as: "user",
  onDelete: "CASCADE",
});

User.hasOne(Customer, {
  foreignKey: { name: "userId", field: "user_id" },
  as: "customer",
  onDelete: "CASCADE",
});
Customer.belongsTo(User, {
  foreignKey: { name: "userId", field: "user_id" },
  as: "user",
  onDelete: "CASCADE",
});

User.hasOne(Seller, {
  foreignKey: { name: "userId", field: "user_id" },
  as: "seller",
  onDelete: "CASCADE",
});
Seller.belongsTo(User, {
  foreignKey: { name: "userId", field: "user_id" },
  as: "user",
  onDelete: "CASCADE",
});

User.hasMany(RefreshToken, {
  foreignKey: { name: "userId", field: "user_id" },
  as: "refreshTokens",
  onDelete: "CASCADE",
});
RefreshToken.belongsTo(User, {
  foreignKey: { name: "userId", field: "user_id" },
  as: "user",
  onDelete: "CASCADE",
});

User.hasMany(UserAuthProvider, {
  foreignKey: { name: "userId", field: "user_id" },
  as: "authProviders",
  onDelete: "CASCADE",
});
UserAuthProvider.belongsTo(User, {
  foreignKey: { name: "userId", field: "user_id" },
  as: "user",
  onDelete: "CASCADE",
});

User.hasMany(PasswordResetSession, {
  foreignKey: { name: "userId", field: "user_id" },
  as: "passwordResetSessions",
  onDelete: "CASCADE",
});
PasswordResetSession.belongsTo(User, {
  foreignKey: { name: "userId", field: "user_id" },
  as: "user",
  onDelete: "CASCADE",
});

User.hasMany(EmailVerification, {
  foreignKey: { name: "userId", field: "user_id" },
  as: "emailVerifications",
  onDelete: "CASCADE",
});
EmailVerification.belongsTo(User, {
  foreignKey: { name: "userId", field: "user_id" },
  as: "user",
  onDelete: "CASCADE",
});

// ==================== PRODUCTS ====================

Category.hasMany(Product, {
  foreignKey: { name: "categoryId", field: "category_id" },
  as: "products",
  onDelete: "RESTRICT",
});
Product.belongsTo(Category, {
  foreignKey: { name: "categoryId", field: "category_id" },
  as: "category",
  onDelete: "RESTRICT",
});

Seller.hasMany(Product, {
  foreignKey: { name: "sellerId", field: "seller_id" },
  as: "products",
});
Product.belongsTo(Seller, {
  foreignKey: { name: "sellerId", field: "seller_id" },
  as: "seller",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Product.hasMany(ProductImage, {
  foreignKey: { name: "productId", field: "product_id" },
  as: "images",
});
ProductImage.belongsTo(Product, {
  foreignKey: { name: "productId", field: "product_id" },
  as: "product",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

// ==================== CART & WISHLIST ====================

Customer.hasMany(Wishlist, {
  foreignKey: { name: "customerId", field: "customer_id" },
  as: "wishlistItems",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});
Wishlist.belongsTo(Customer, {
  foreignKey: { name: "customerId", field: "customer_id" },
  as: "customer",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Product.hasMany(Wishlist, {
  foreignKey: { name: "productId", field: "product_id" },
  as: "wishlistedBy",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});
Wishlist.belongsTo(Product, {
  foreignKey: { name: "productId", field: "product_id" },
  as: "product",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Customer.hasOne(Cart, {
  foreignKey: { name: "customerId", field: "customer_id" },
  as: "cart",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});
Cart.belongsTo(Customer, {
  foreignKey: { name: "customerId", field: "customer_id" },
  as: "customer",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Cart.hasMany(CartItem, {
  foreignKey: { name: "cartId", field: "cart_id" },
  as: "items",
  onDelete: "CASCADE",
});
CartItem.belongsTo(Cart, {
  foreignKey: { name: "cartId", field: "cart_id" },
  as: "cart",
  onDelete: "CASCADE",
});

Product.hasMany(CartItem, {
  foreignKey: { name: "productId", field: "product_id" },
  as: "inCartItems",
  onDelete: "CASCADE",
});
CartItem.belongsTo(Product, {
  foreignKey: { name: "productId", field: "product_id" },
  as: "product",
  onDelete: "CASCADE",
});

// ==================== ORDERS ====================

Customer.hasMany(Order, {
  foreignKey: { name: "customerId", field: "customer_id" },
  as: "orders",
});
Order.belongsTo(Customer, {
  foreignKey: { name: "customerId", field: "customer_id" },
  as: "customer",
  onDelete: "RESTRICT",
  onUpdate: "CASCADE",
});

Seller.hasMany(Order, {
  foreignKey: { name: "sellerId", field: "seller_id" },
  as: "orders",
});
Order.belongsTo(Seller, {
  foreignKey: { name: "sellerId", field: "seller_id" },
  as: "seller",
  onDelete: "RESTRICT",
  onUpdate: "CASCADE",
});

Order.hasMany(OrderItem, {
  foreignKey: { name: "orderId", field: "order_id" },
  as: "items",
});
OrderItem.belongsTo(Order, {
  foreignKey: { name: "orderId", field: "order_id" },
  as: "order",
  onDelete: "CASCADE",
});

Product.hasMany(OrderItem, {
  foreignKey: { name: "productId", field: "product_id" },
  as: "orderItems",
  onDelete: "RESTRICT",
});
OrderItem.belongsTo(Product, {
  foreignKey: { name: "productId", field: "product_id" },
  as: "product",
});

// ==================== NOTIFICATIONS ====================

User.belongsToMany(Notification, {
  through: UserNotification,
  foreignKey: { name: "userId", field: "user_id" },
  otherKey: { name: "notificationId", field: "notification_id" },
  as: "notifications",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});
Notification.belongsToMany(User, {
  through: UserNotification,
  foreignKey: { name: "notificationId", field: "notification_id" },
  otherKey: { name: "userId", field: "user_id" },
  as: "recipients",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});
Notification.belongsTo(User, {
  foreignKey: { name: "senderId", field: "sender_id" },
  as: "sender",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

Notification.belongsTo(Order, {
  foreignKey: { name: "relatedOrderId", field: "related_order_id" },
  as: "order",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

// ==================== REVIEWS ====================

Customer.hasMany(Review, {
  foreignKey: { name: "customerId", field: "customer_id" },
  as: "reviews",
});
Review.belongsTo(Customer, {
  foreignKey: { name: "customerId", field: "customer_id" },
  as: "customer",
  onDelete: "RESTRICT",
  onUpdate: "CASCADE",
});

Product.hasMany(Review, {
  foreignKey: { name: "productId", field: "product_id" },
  as: "reviews",
});
Review.belongsTo(Product, {
  foreignKey: { name: "productId", field: "product_id" },
  as: "product",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Order.hasMany(Review, {
  foreignKey: { name: "orderId", field: "order_id" },
  as: "reviews",
  onDelete: "SET NULL",
});
Review.belongsTo(Order, {
  foreignKey: { name: "orderId", field: "order_id" },
  as: "order",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

// ==================== CONVERSATIONS ====================

User.hasMany(Conversation, {
  foreignKey: { name: "sellerId", field: "seller_id" },
  as: "sellingConversations",
});

User.hasMany(Conversation, {
  foreignKey: { name: "customerId", field: "customer_id" },
  as: "buyingConversations",
});

Conversation.belongsTo(User, {
  foreignKey: { name: "sellerId", field: "seller_id" },
  as: "seller",
  onDelete: "RESTRICT",
  onUpdate: "CASCADE",
});

Conversation.belongsTo(User, {
  foreignKey: { name: "customerId", field: "customer_id" },
  as: "customer",
  onDelete: "RESTRICT",
  onUpdate: "CASCADE",
});

// ==================== MESSAGES ====================

Conversation.hasMany(Message, {
  foreignKey: { name: "conversationId", field: "conversation_id" },
  as: "messages",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});
Message.belongsTo(Conversation, {
  foreignKey: { name: "conversationId", field: "conversation_id" },
  as: "conversation",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

User.hasMany(Message, {
  foreignKey: { name: "senderId", field: "sender_id" },
  as: "sentMessages",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});
Message.belongsTo(User, {
  foreignKey: { name: "senderId", field: "sender_id" },
  as: "sender",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Product.hasMany(Message, {
  foreignKey: { name: "productId", field: "product_id" },
  as: "messages",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});
Message.belongsTo(Product, {
  foreignKey: { name: "productId", field: "product_id" },
  as: "product",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

module.exports = {
  User, Role, Address,
  Customer, Seller,
  RefreshToken, UserAuthProvider, PasswordResetSession, EmailVerification,
  Category, Product, ProductImage,
  Wishlist, Cart, CartItem,
  Order, OrderItem,
  Notification, UserNotification,
  Review,
  Conversation, Message,
};