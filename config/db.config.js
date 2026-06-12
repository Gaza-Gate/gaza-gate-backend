const { Sequelize } = require("sequelize");

const sequelizeInstance = new Sequelize(process.env.MYSQL_URI, {
  dialect: "mysql",
  logging: false,
});

const connectDB = async () => {
  try {
    await sequelizeInstance.authenticate();
    console.log(`Database connection successfully`);
  } catch (error) {
    console.error(`Database connection failed: ${error.message}`);
    process.exit(1);
  }
};

const closeDB = async () => {
  try {
    if (sequelizeInstance) {
      await sequelizeInstance.close();
      console.log(`Database connection closed successfully`);
    }
  } catch (error) {
    console.error(`Database close connection failed: ${error.message}`);
    throw error;
  }
};

module.exports = {
  connectDB,
  closeDB,
  sequelize: sequelizeInstance,
};
