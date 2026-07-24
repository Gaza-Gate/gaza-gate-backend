const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db.config.js");

const Review = sequelize.define(
  "Review",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "customer_id",
    },
    sellerId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "seller_id",
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "product_id",
    },
    orderId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "order_id",
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 5,
      },
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    imageUrl: {
      type: DataTypes.STRING(512),
      allowNull: true,
      field: "image_url",
    },
    publicId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "public_id",
    },
    sellerReply: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "seller_reply",
    },
    sellerRepliedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "seller_replied_at",
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "is_deleted",
    },
  },
  {
    tableName: "review",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
    indexes: [
      { fields: ["product_id"] },
      { fields: ["customer_id"] },
      { unique: true, fields: ["customer_id", "product_id"] },
    ],
  },
);

module.exports = Review;
