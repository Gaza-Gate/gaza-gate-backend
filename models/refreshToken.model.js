const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db.config.js");

const RefreshToken = sequelize.define(
  "RefreshToken",
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
    tokenHash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
      field: "token_hash",
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "expires_at",
    },
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "revoked_at",
    },
  },
  {
    tableName: "refresh_token",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,

    indexes: [
      { fields: ["user_id"] },
      { fields: ["expires_at"] },
      { fields: ["revoked_at"] },
    ],
  },
);

module.exports = RefreshToken;
