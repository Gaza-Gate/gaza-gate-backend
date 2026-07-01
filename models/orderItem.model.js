const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db.config.js");

const OrderItem = sequelize.define(
  "OrderItem",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    orderId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "order_id",
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "product_id",
    },
    productName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: "product_name",
    },
    productImage: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "product_image",
    },
    unitPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: "unit_price",
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
      },
    },
    lineTotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: "line_total",
    },
    customizationNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "customization_notes",
    },
  },
  {
    tableName: "order_items",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
    indexes: [
      { fields: ["order_id"] },
      { fields: ["product_id"] },
      {
        unique: true,
        fields: ["order_id", "product_id"],
      },
    ],
  },
);

module.exports = OrderItem;
