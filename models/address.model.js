const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db.config.js");

const Address = sequelize.define(
  "Address",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "user_id",
    },
    neighborhood: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 100],
      },
    },
    street: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 255],
      },
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "address",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
    indexes: [{ fields: ["user_id"] }],
  },
);

module.exports = Address;
