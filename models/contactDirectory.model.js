const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db.config.js");
const {
  CONTACT_DIRECTORY_LIMITS,
} = require("../constants/contactDirectory/contactDirectory.constant.js");

const ContactDirectory = sequelize.define(
  "ContactDirectory",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    deliveryName: {
      type: DataTypes.STRING(CONTACT_DIRECTORY_LIMITS.DELIVERY_NAME_MAX),
      allowNull: false,
      field: "delivery_name",
      validate: {
        notEmpty: true,
        len: [1, CONTACT_DIRECTORY_LIMITS.DELIVERY_NAME_MAX],
      },
      set(value) {
        this.setDataValue("deliveryName", value.trim());
      },
    },
    phone: {
      type: DataTypes.STRING(CONTACT_DIRECTORY_LIMITS.PHONE_MAX),
      allowNull: false,
    },
  },
  {
    tableName: "contact_directory",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
    indexes: [{ fields: ["delivery_name"] }],
  },
);

module.exports = ContactDirectory;
