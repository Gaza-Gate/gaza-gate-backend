const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db.config.js");

const UserAuthProvider = sequelize.define(
  "UserAuthProvider",
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
    provider: {
      type: DataTypes.ENUM("google", "facebook"),
      allowNull: false,
    },
    providerId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "provider_id",
    },
  },
  {
    tableName: "user_auth_provider",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["provider", "provider_id"],
      },
      {
        fields: ["user_id"],
      },
    ],
  },
);

module.exports = UserAuthProvider;
