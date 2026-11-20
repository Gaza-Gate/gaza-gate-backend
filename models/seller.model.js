const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db.config.js");
const { STORE_SLUG_LIMITS } = require("../constants/seller/storeSlug.constant.js");

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
    // Public store URL: /store/<slug>. Generated from storeName on create
    // (see beforeCreate hook) and editable by the seller. NULL only for rows
    // created before the slug columns existed — links fall back to the id.
    slug: {
      type: DataTypes.STRING(STORE_SLUG_LIMITS.MAX),
      allowNull: true,
      unique: true,
    },
    slugChangedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "slug_changed_at",
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
    latitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
    longitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
    locatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "located_at",
    },
  },
  {
    tableName: "seller",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
    indexes: [{ fields: ["latitude", "longitude"] }],
  },
);

// Every new store gets a unique slug from its name (all create paths:
// local register, Google register, become-seller).
Seller.beforeCreate(async (seller, options) => {
  if (seller.slug) return;
  // required lazily: the service depends on this model
  const { generateUniqueStoreSlug } = require("../services/profile/storeSlug.service.js");
  seller.slug = await generateUniqueStoreSlug(seller.storeName, {
    transaction: options.transaction,
  });
});

module.exports = Seller;
