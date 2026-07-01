const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db.config.js");

const Customer = sequelize.define(
  "Customer",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      field: "user_id",
    },
  },
  {
    tableName: "customer",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
  },
);

module.exports = Customer;

/*
    totalOrders: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "total_orders",
      validate: {
        min: 0,
      },
    },
    totalCustomers: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "total_customers",
      validate: {
        min: 0,
      },
    },
*/
