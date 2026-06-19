const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db.config.js");
const ORDER_STATUSES = require("../constants/orderStatuses.constant.js");

const Order = sequelize.define(
  "Order",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    orderNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      field: "order_number",
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "customer_id",
    },
    sellerId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "seller_id",
    },
    status: {
      type: DataTypes.ENUM(
        ORDER_STATUSES.PENDING_REVIEW,
        ORDER_STATUSES.ACCEPTED,
        ORDER_STATUSES.REJECTED,
        ORDER_STATUSES.IN_PRODUCTION,
        ORDER_STATUSES.READY,
        ORDER_STATUSES.COMPLETED,
        ORDER_STATUSES.CANCELLED,
      ),
      allowNull: false,
      defaultValue: ORDER_STATUSES.PENDING_REVIEW,
    },
    paymentMethod: {
      type: DataTypes.ENUM("cash_on_delivery", "online"),
      allowNull: false,
      defaultValue: "cash_on_delivery",
      field: "payment_method",
    },
    paymentStatus: {
      type: DataTypes.ENUM("pending", "paid"),
      allowNull: false,
      defaultValue: "pending",
      field: "payment_status",
    },
    shippingNeighborhood: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: "shipping_neighborhood",
    },
    shippingStreet: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "shipping_street",
    },
    shippingNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "shipping_notes",
    },
    customerNote: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "customer_note",
    },
    sellerNote: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "seller_note",
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "rejection_reason",
    },
    expectedDeliveryAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "expected_delivery_at",
    },

    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "reviewed_at",
    },
    acceptedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "accepted_at",
    },
    rejectedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "rejected_at",
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "completed_at",
    },

    subtotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    discountAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      field: "discount_amount",
    },
    shippingFee: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      field: "delivery_fee",
    },
    totalPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      field: "total_price",
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "is_deleted",
    },
  },
  {
    tableName: "orders",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
    indexes: [
      { fields: ["customer_id"] },
      { fields: ["seller_id"] },
      { fields: ["status"] },
      { fields: ["payment_status"] },
      { fields: ["created_at"] },
    ],
    validate: {
      moneyValidation() {
        const subtotal = Number(this.subtotal);
        const discountAmount = Number(this.discountAmount);
        const shippingFee = Number(this.shippingFee);
        const totalPrice = Number(this.totalPrice);

        if (subtotal < 0) throw new Error("subtotal cannot be negative");
        if (discountAmount < 0)
          throw new Error("discountAmount cannot be negative");
        if (shippingFee < 0) throw new Error("shippingFee cannot be negative");
        if (totalPrice < 0) throw new Error("totalPrice cannot be negative");
      },
    },
  },
);

module.exports = Order;
