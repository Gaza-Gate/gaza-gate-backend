const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db.config.js");

const EmailVerification = sequelize.define(
  "EmailVerification",
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
    code: {
      type: DataTypes.STRING(6),
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "email_activation",
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "expires_at",
    },
  },
  {
    tableName: "email_verification",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
    indexes: [
      { fields: ["user_id", "type"] },
      { fields: ["user_id", "code", "type"] },
    ],
  },
);

module.exports = EmailVerification;
