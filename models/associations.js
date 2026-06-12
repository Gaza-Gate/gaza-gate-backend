const User = require("./user.model");
const Role = require("./role.model");
const Address = require("./address.model");
const Customer = require("./customer.model");
const Seller = require("./seller.model");
const RefreshToken = require("./refreshToken.model");
const PasswordResetSession = require("./passwordResetSession.model.js");
const UserAuthProvider = require("./UserAuthProvider.model.js");

Role.hasMany(User, {
  foreignKey: { name: "roleId", field: "role_id" },
  as: "users",
});
User.belongsTo(Role, {
  foreignKey: { name: "roleId", field: "role_id" },
  as: "role",
});

User.hasMany(Address, {
  foreignKey: { name: "userId", field: "user_id" },
  as: "addresses",
  onDelete: "CASCADE",
});
Address.belongsTo(User, {
  foreignKey: { name: "userId", field: "user_id" },
  as: "user",
});

User.hasOne(Customer, {
  foreignKey: { name: "userId", field: "user_id" },
  as: "customer",
  onDelete: "CASCADE",
});
Customer.belongsTo(User, {
  foreignKey: { name: "userId", field: "user_id" },
  as: "user",
});

User.hasOne(Seller, {
  foreignKey: { name: "userId", field: "user_id" },
  as: "seller",
  onDelete: "CASCADE",
});
Seller.belongsTo(User, {
  foreignKey: { name: "userId", field: "user_id" },
  as: "user",
});

User.hasMany(RefreshToken, {
  foreignKey: { name: "userId", field: "user_id" },
  as: "refreshTokens",
  onDelete: "CASCADE",
});

RefreshToken.belongsTo(User, {
  foreignKey: { name: "userId", field: "user_id" },
  as: "user",
});

User.hasMany(UserAuthProvider, {
  foreignKey: "userId",
  as: "authProviders",
});

UserAuthProvider.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

User.hasMany(PasswordResetSession, {
  foreignKey: {
    name: "userId",
    field: "user_id",
  },
  as: "passwordResetSessions",
  onDelete: "CASCADE",
});

PasswordResetSession.belongsTo(User, {
  foreignKey: {
    name: "userId",
    field: "user_id",
  },
  as: "user",
});

module.exports = {
  User,
  Role,
  Address,
  Customer,
  Seller,
  RefreshToken,
  UserAuthProvider,
  PasswordResetSession
};
