const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db.config.js");

const Category = sequelize.define(
  "Category",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [2, 100],
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    image: {
      type: DataTypes.STRING(512),
      allowNull: true,
      defaultValue:
        "https://res.cloudinary.com/dq0z2abbv/image/upload/f_auto,q_auto/v1782711092/1782710900515_a1f9fc.png",
    },
    publicId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "public_id",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "is_active",
    },
  },
  {
    tableName: "category",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
  },
);

module.exports = Category;
