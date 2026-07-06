const isUserInConversationRoom = (io, conversationId, userId) => {
  const room = io.sockets.adapter.rooms.get(`conversation:${conversationId}`);
  if (!room) return false;

  for (const socketId of room) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket && socket.userId === userId) return true;
  }

  return false;
};

module.exports = { isUserInConversationRoom };
