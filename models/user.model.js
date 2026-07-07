const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db.config.js");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    roleId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "role_id",
    },
    firstName: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: "first_name",
      validate: {
        notEmpty: true,
        len: [2, 50],
      },
    },
    lastName: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: "last_name",
      validate: {
        notEmpty: true,
        len: [2, 50],
      },
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        notEmpty: true,
      },
      set(value) {
        this.setDataValue("email", value.toLowerCase().trim());
      },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        passwordCheck(value) {
          if (value == null) return;
          if (value.trim() === "") throw new Error("Password cannot be empty");
          if (value.length < 8) throw new Error("Password min 8 characters");
        },
      },
    },
    birthDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "birth_date",
    },
    gender: {
      type: DataTypes.ENUM("male", "female", "other"),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    avatar: {
      type: DataTypes.STRING(512),
      allowNull: false,
      field: "avatar",
      defaultValue:
        "https://res.cloudinary.com/dq0z2abbv/image/upload/f_auto,q_auto/v1782715016/1782700270979_strw1t.png",
    },
    publicId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "public_id",
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "is_verified",
    },
    status: {
      type: DataTypes.ENUM("active", "banned"),
      allowNull: false,
      defaultValue: "active",
    },
    passwordChangedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "password_changed_at",
    },
  },
  {
    tableName: "user",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
    defaultScope: {
      attributes: {
        exclude: ["password"],
      },
    },
    indexes: [
      { fields: ["role_id"] },
      { fields: ["status"] },
      { fields: ["is_verified"] },
    ],
  },
);

module.exports = User;
