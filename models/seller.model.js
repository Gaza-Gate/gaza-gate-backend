const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db.config.js");

const Seller = sequelize.define(
  "Seller",
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
    storeName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: "store_name",
      validate: { notEmpty: true, len: [2, 100] },
    },
    storeDescription: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "store_description",
      validate: {
        lenIfPresent(value) {
          if (value == null || value === "") return;
          if (value.length < 5 || value.length > 500) {
            throw new Error(
              "Store description must be between 5 and 500 characters",
            );
          }
        },
      },
    },
    rating: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0.0,
      validate: { min: 0, max: 5 },
    },
    ratingCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "rating_count",
      validate: { min: 0 },
    },
  },
  {
    tableName: "seller",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
  },
);

module.exports = Seller;
