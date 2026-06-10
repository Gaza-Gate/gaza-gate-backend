const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db.config.js");

const UserNotification = sequelize.define(
  "UserNotification",
  {
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      field: "user_id",
    },
    notificationId: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      field: "notification_id",
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "is_read",
    },
  },
  {
    tableName: "user_notification",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
    underscored: true,

    indexes: [
      { fields: ["user_id"] },
      { fields: ["notification_id"] },
      { fields: ["is_read"] },
      { fields: ["created_at"] },
    ],
  },
);

module.exports = UserNotification;
