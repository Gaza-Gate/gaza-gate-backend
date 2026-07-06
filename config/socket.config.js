const { Server } = require("socket.io");
const token = require("../utils/token.util.js");
const User = require("../models/user.model.js");
const UserStatus = require("../constants/userStatus.constant.js");

const registerConversationHandlers = require("../socket/handlers/conversation.handler.js");

let io = null;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: ["https://gaza-gate-frontend.vercel.app", "http://localhost:3000"],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const authToken = socket.handshake.auth?.token;
      if (!authToken) return next(new Error("Authentication token missing."));

      const decoded = token.verifyAccessToken(authToken);

      const user = await User.findByPk(decoded.userId);
      if (!user || user.status === UserStatus.BANNED) {
        return next(new Error("Account is banned or does not exist."));
      }

      socket.userId = decoded.userId;
      socket.role = decoded.role;
      next();
    } catch (error) {
      next(new Error("Invalid or expired authentication token."));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.userId}`);
    registerConversationHandlers(io, socket);
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error("Socket.IO not initialized.");
  return io;
};

const emitToUser = (userId, event, payload) => {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
};

module.exports = { initSocket, getIO, emitToUser };
