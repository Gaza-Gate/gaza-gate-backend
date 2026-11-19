const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db.config.js");

const SellerCustomerReview = sequelize.define(
  "SellerCustomerReview",
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
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "customer_id",
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
      allowNull: true,
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "is_deleted",
    },
  },
  {
    tableName: "seller_customer_review",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
    indexes: [
      { fields: ["customer_id"] },
      { fields: ["seller_id"] },
      { unique: true, fields: ["seller_id", "order_id"] },
    ],
  },
);

module.exports = SellerCustomerReview;
