const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db.config.js");

const PasswordResetSession = sequelize.define(
  "PasswordResetSession",
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
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "expires_at",
    },
    usedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "used_at",
    },
  },
  {
    tableName: "password_reset_sessions",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
    underscored: true,
    indexes: [{ fields: ["user_id"] }, { fields: ["expires_at"] }],
  },
);

module.exports = PasswordResetSession;
