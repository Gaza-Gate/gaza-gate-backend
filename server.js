const app = require("./app.js");
const { connectDB, sequelize } = require("./config/db.config.js");
const seedRoles = require("./startup/seedRoles.js");

async function startServer() {
  try {
    await connectDB();
    
    await sequelize.sync();
    await seedRoles();

    app.listen(process.env.PORT, () => {
      console.log("Server running");
    });
  } catch (error) {
    console.error("Startup failed:", error);
    process.exit(1);
  }
}

startServer();