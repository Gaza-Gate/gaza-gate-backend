const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db.config.js");

const Message = sequelize.define(
  "Message",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    conversationId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "conversation_id",
    },
    senderId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "sender_id",
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Content cannot be empty",
        },
      },
      set(value) {
        this.setDataValue("content", value?.trim() || "");
      },
    },
    messageType: {
      type: DataTypes.ENUM("text"),
      defaultValue: "text",
      field: "message_type",
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "product_id",
    },
  },
  {
    tableName: "messages",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
    indexes: [
      { fields: ["conversation_id"] },
      { fields: ["sender_id"] },
    ],
  }
);

module.exports = Message;