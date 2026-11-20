const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db.config.js");
const { STORE_SLUG_LIMITS } = require("../constants/seller/storeSlug.constant.js");

// Slugs a store used before. They keep redirecting to the store forever,
// and no other store can take them.
const SellerSlugHistory = sequelize.define(
  "SellerSlugHistory",
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
    slug: {
      type: DataTypes.STRING(STORE_SLUG_LIMITS.MAX),
      allowNull: false,
      unique: true,
    },
  },
  {
    tableName: "seller_slug_history",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
    underscored: true,
    indexes: [{ fields: ["seller_id"] }],
  },
);

module.exports = SellerSlugHistory;
