const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db.config.js");

const Role = sequelize.define(
  "Role",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [2, 50],
      },
    },
  },
  {
    tableName: "role",
    timestamps: false,
    underscored: true,
  },
);

module.exports = Role;
