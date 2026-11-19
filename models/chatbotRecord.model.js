const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db.config.js");
const {
  CHATBOT_RECORD_TYPES,
  UNANSWERED_QUESTION_STATUS,
} = require("../constants/chatbot/chatbot.constant.js");
const {
  SELLER_CHAT_MESSAGE_ROLES,
} = require("../constants/chatbot/sellerChatbot.constant.js");

const ChatbotRecord = sequelize.define(
  "ChatbotRecord",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "user_id",
    },
    recordType: {
      type: DataTypes.ENUM(
        CHATBOT_RECORD_TYPES.CUSTOMER_QUESTION,
        CHATBOT_RECORD_TYPES.SELLER_SESSION,
        CHATBOT_RECORD_TYPES.SELLER_MESSAGE,
      ),
      allowNull: false,
      field: "record_type",
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    sessionId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "session_id",
    },
    role: {
      type: DataTypes.ENUM(
        SELLER_CHAT_MESSAGE_ROLES.USER,
        SELLER_CHAT_MESSAGE_ROLES.ASSISTANT,
        SELLER_CHAT_MESSAGE_ROLES.TOOL,
      ),
      allowNull: true,
    },
    toolName: {
      type: DataTypes.STRING(64),
      allowNull: true,
      field: "tool_name",
    },
    status: {
      type: DataTypes.ENUM(
        UNANSWERED_QUESTION_STATUS.PENDING,
        UNANSWERED_QUESTION_STATUS.REVIEWED,
      ),
      allowNull: true,
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "reviewed_at",
    },
    reviewedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "reviewed_by",
    },
  },
  {
    tableName: "chatbot_records",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
    indexes: [
      { fields: ["user_id"] },
      { fields: ["record_type"] },
      { fields: ["session_id"] },
      { fields: ["status"] },
      { fields: ["created_at"] },
    ],
  },
);

module.exports = ChatbotRecord;
