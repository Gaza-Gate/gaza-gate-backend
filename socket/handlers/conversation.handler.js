const conversationService = require("../../services/conversation/conversation.service.js");
const AppError = require("../../utils/http/AppError.util.js");

const getErrorMessage = (error) => {
  if (error instanceof AppError) {
    return error.message;
  }
  return error?.message || "An unexpected error occurred.";
};

const registerConversationHandlers = (io, socket) => {
  socket.on("join_conversation", async ({ conversationId } = {}) => {
    try {
      if (!conversationId) {
        socket.emit("error", { message: "conversationId is required." });
        return;
      }

      const conversation =
        await conversationService.loadConversationOrFail(conversationId);
      conversationService.assertParticipant(conversation, socket.userId);

      socket.join(`conversation:${conversationId}`);
      await conversationService.markAsRead(socket.userId, conversationId);
      socket.emit("joined_conversation", { conversationId });
    } catch (error) {
      socket.emit("error", { message: getErrorMessage(error) });
    }
  });

  socket.on(
    "send_message",
    async ({ conversationId, content, productId } = {}) => {
      try {
        if (!conversationId) {
          socket.emit("error", { message: "conversationId is required." });
          return;
        }

        const message = await conversationService.sendMessage(
          socket.userId,
          conversationId,
          {
            content,
            productId,
          },
        );

        socket.emit("message_sent", { message });
      } catch (error) {
        socket.emit("error", { message: getErrorMessage(error) });
      }
    },
  );

  socket.on("mark_read", async ({ conversationId } = {}) => {
    try {
      if (!conversationId) {
        socket.emit("error", { message: "conversationId is required." });
        return;
      }

      await conversationService.markAsRead(socket.userId, conversationId);
    } catch (error) {
      socket.emit("error", { message: getErrorMessage(error) });
    }
  });

  socket.on("typing", async ({ conversationId, isTyping } = {}) => {
    try {
      if (!conversationId) {
        return;
      }

      const conversation =
        await conversationService.loadConversationOrFail(conversationId);
      conversationService.assertParticipant(conversation, socket.userId);

      socket.to(`conversation:${conversationId}`).emit("typing", {
        conversationId,
        userId: socket.userId,
        isTyping: !!isTyping,
      });
    } catch {
      // Typing is best-effort; ignore failures.
    }
  });

  socket.on(
    "update_message",
    async ({ conversationId, messageId, content } = {}) => {
      try {
        if (!conversationId || !messageId) {
          socket.emit("error", {
            message: "conversationId and messageId are required.",
          });
          return;
        }

        const message = await conversationService.updateMessage(
          socket.userId,
          conversationId,
          messageId,
          { content },
        );

        socket.emit("message_updated_ack", { message });
      } catch (error) {
        socket.emit("error", { message: getErrorMessage(error) });
      }
    },
  );

  socket.on("delete_message", async ({ conversationId, messageId } = {}) => {
    try {
      if (!conversationId || !messageId) {
        socket.emit("error", {
          message: "conversationId and messageId are required.",
        });
        return;
      }

      const data = await conversationService.deleteMessage(
        socket.userId,
        conversationId,
        messageId,
      );

      socket.emit("message_deleted_ack", data);
    } catch (error) {
      socket.emit("error", { message: getErrorMessage(error) });
    }
  });
};

module.exports = registerConversationHandlers;
