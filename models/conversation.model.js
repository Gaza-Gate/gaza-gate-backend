const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db.config.js");

const Conversation = sequelize.define(
  "Conversation",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    sellerId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "seller_id",
      validate: {
        notEmpty: {
          msg: "Seller ID cannot be empty",
        },
      },
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "customer_id",
      validate: {
        notEmpty: {
          msg: "Customer ID cannot be empty",
        },
      },
    },
    sourceType: {
      type: DataTypes.ENUM("product", "seller", "direct"),
      allowNull: false,
      defaultValue: "direct",
      field: "source_type",
    },
    sourceId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "source_id",
    },
    lastMessageId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "last_message_id",
    },
    lastMessageAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "last_message_at",
    },
    activeProductId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "active_product_id",
    },
  },
  {
    tableName: "conversations",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["seller_id", "customer_id"],
      },
    ],
  },
);

module.exports = Conversation;
