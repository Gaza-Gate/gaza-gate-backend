const http = require("http");
const app = require("./app.js");
const { connectDB, sequelize } = require("./config/db.config.js");
const seedRoles = require("./startup/seedRoles.js");
const { initSocket } = require("./config/socket.config.js");
const {
  loadKnowledgeBase,
} = require("./services/ai/chatbot/aiChatbotPrompt.service.js");

async function startServer() {
  try {
    await connectDB();

    //await sequelize.sync();
    await seedRoles();
    await loadKnowledgeBase();

    const httpServer = http.createServer(app);
    initSocket(httpServer);

    httpServer.listen(process.env.PORT, () => {
      console.log("Server running");
    });
  } catch (error) {
    console.error("Startup failed:", error);
    process.exit(1);
  }
}

startServer();
