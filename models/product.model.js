const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db.config.js");
const PRODUCT_STOCK_TYPES = require("../constants/stockType.constants.js");
const PRODUCT_STATUS = require("../constants/productStatus.constants.js");

const Product = sequelize.define(
  "Product",
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
    categoryId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "category_id",
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 100],
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        min: 0.01,
      },
    },
    stockType: {
      type: DataTypes.ENUM(
        PRODUCT_STOCK_TYPES.LIMITED,
        PRODUCT_STOCK_TYPES.UNLIMITED,
      ),
      allowNull: false,
      defaultValue: PRODUCT_STOCK_TYPES.UNLIMITED,
      field: "stock_type",
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 0,
      },
    },
    status: {
      type: DataTypes.ENUM(PRODUCT_STATUS.ACTIVE, PRODUCT_STATUS.HIDDEN),
      allowNull: false,
      defaultValue: PRODUCT_STATUS.ACTIVE,
    },
    averageRating: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0,
      field: "average_rating",
      validate: {
        min: 0,
        max: 5,
      },
    },
    reviewsCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "reviews_count",
      validate: {
        min: 0,
      },
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "is_deleted",
    },
  },
  {
    tableName: "product",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
    validate: {
      quantityValidation() {
        if (
          this.stockType === PRODUCT_STOCK_TYPES.LIMITED &&
          (this.quantity === null || this.quantity === undefined)
        ) {
          throw new Error("Quantity is required for limited stock products");
        }
        if (
          this.stockType === PRODUCT_STOCK_TYPES.UNLIMITED &&
          this.quantity != null
        ) {
          throw new Error("Quantity must be null for unlimited stock products");
        }
      },
    },
    indexes: [
      { fields: ["name"] },
      { fields: ["seller_id"] },
      { fields: ["category_id"] },
      { fields: ["status"] },
      { fields: ["is_deleted"] },
    ],
  },
);

module.exports = Product;

/*

averageRating: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
      field: "average_rating",
    },

    reviewsCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "reviews_count",
    },




slug: {
  type: DataTypes.STRING(150),
  unique: true,
  allowNull: false,
}

*/
