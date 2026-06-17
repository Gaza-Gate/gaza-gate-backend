const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db.config.js");

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
      unique: true,
      field: "store_name",
      validate: {
        notEmpty: true,
        len: [2, 100],
      },
    },
    storeDescription: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "store_description",
      validate: {
        notEmpty: true,
        len: [5, 500],
      },
    },
   /* rating: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
      defaultValue: 0.00,
      validate: {
        min: 0,
        max: 5,
      },
    },
    ratingCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      field: "rating_count",
      validate: {
        min: 0,
      },
    },*/
  }, 
  {
    tableName: "seller",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
  },
);

module.exports = Seller;

/*

    
    
        /*
    totalOrders: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "total_orders",
      validate: {
        min: 0,
      },
    },
    totalCustomers: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "total_customers",
      validate: {
        min: 0,
      },
    },
    
    
    
    balance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      validate: {
        min: 0,
      },
    }
*/
