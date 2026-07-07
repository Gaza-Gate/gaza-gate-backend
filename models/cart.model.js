const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db.config.js");

const Cart = sequelize.define(
  "Cart",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      field: "customer_id",
    },
  },
  {
    tableName: "cart",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
  },
);

module.exports = Cart;
