const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db.config.js");

const Wishlist = sequelize.define(
  "Wishlist",
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
    productId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "product_id",
    },
  },
  {
    tableName: "wishlist",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
    underscored: true,
    indexes: [
      { fields: ["customer_id"] },
      { fields: ["product_id"] },
      { unique: true, fields: ["customer_id", "product_id"] },
    ],
  },
);

module.exports = Wishlist;