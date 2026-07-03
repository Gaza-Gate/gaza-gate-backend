const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db.config.js");
const { UNANSWERED_QUESTION_STATUS } = require("../constants/chatbot.constant.js");

const UnansweredQuestion = sequelize.define(
  "UnansweredQuestion",
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
    question: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [3, 1000],
      },
    },
    status: {
      type: DataTypes.ENUM(
        UNANSWERED_QUESTION_STATUS.PENDING,
        UNANSWERED_QUESTION_STATUS.REVIEWED,
      ),
      allowNull: false,
      defaultValue: UNANSWERED_QUESTION_STATUS.PENDING,
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
    tableName: "unanswered_question",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
    indexes: [
      { fields: ["user_id"] },
      { fields: ["status"] },
      { fields: ["created_at"] },
    ],
  },
);

module.exports = UnansweredQuestion;
