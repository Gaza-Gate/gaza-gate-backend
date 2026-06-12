const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db.config.js");

const Notification = sequelize.define(
  "Notification",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    senderId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "sender_id",
    },
    type: {
      type: DataTypes.ENUM(
        "SYSTEM",
        "PROMOTIONAL",
        "ORDER",
        "ACCOUNT",
        "GENERAL",
      ),
      allowNull: false,
      defaultValue: "GENERAL",
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    actionUrl: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "action_url",
    },
    relatedOrderId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "related_order_id",
    },
    sentAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "sent_at",
    },
  },
  {
    tableName: "notification",
    timestamps: false,
    underscored: true,
    indexes: [
      { fields: ["sender_id"] },
      { fields: ["type"] },
      { fields: ["sent_at"] },
    ],
  },
);

module.exports = Notification;
