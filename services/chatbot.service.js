const UnansweredQuestion = require("../models/unansweredQuestion.model.js");
const User = require("../models/user.model.js");
const aiChatbotService = require("./aiChatbot.service.js");
const {
  CHATBOT,
  UNANSWERED_QUESTION_STATUS,
} = require("../constants/chatbot.constant.js");
const PAGINATION = require("../constants/pagination.constant.js");
const AppError = require("../utils/AppError.util.js");

const getFallbackMessage = () =>
  CHATBOT.FALLBACK_MESSAGE.replace("{email}", CHATBOT.SUPPORT_EMAIL);

const storeUnansweredQuestion = async (userId, question) => {
  return UnansweredQuestion.create({
    userId,
    question: question.trim(),
    status: UNANSWERED_QUESTION_STATUS.PENDING,
  });
};

const buildFallbackResponse = async (userId, question) => {
  const storedQuestion = await storeUnansweredQuestion(userId, question);

  return {
    found: false,
    answer: getFallbackMessage(),
    source: "fallback",
    unansweredQuestionId: storedQuestion.id,
    supportEmail: CHATBOT.SUPPORT_EMAIL,
  };
};

const askQuestion = async (userId, question) => {
  const trimmedQuestion = question.trim();

  const aiResult = await aiChatbotService.askAi(trimmedQuestion);

  if (aiResult.canAnswer && aiResult.answer) {
    return {
      found: true,
      answer: aiResult.answer,
      source: "ai",
    };
  }

  // Either the AI could not answer from the knowledge base, or it was
  // unavailable/errored. In all cases store the question for admin review.
  return buildFallbackResponse(userId, trimmedQuestion);
};

const getUnansweredQuestions = async (query = {}) => {
  const page = Math.max(Number(query.page) || PAGINATION.DEFAULT_PAGE, 1);
  const limit = PAGINATION.DEFAULT_LIMIT;
  const offset = (page - 1) * limit;

  const where = {};
  if (
    query.status &&
    Object.values(UNANSWERED_QUESTION_STATUS).includes(query.status)
  ) {
    where.status = query.status;
  }

  const { count, rows } = await UnansweredQuestion.findAndCountAll({
    where,
    attributes: ["id", "question", "status", ["created_at", "createdAt"]],
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "firstName", "lastName", "email"],
      },
    ],
    order: [["created_at", "DESC"]],
    limit,
    offset,
    distinct: true,
  });

  const totalPages = Math.ceil(count / limit);

  return {
    questions: rows.map((row) => ({
      id: row.id,
      question: row.question,
      status: row.status,
      createdAt: row.dataValues.createdAt,
      customer: row.user
        ? {
            id: row.user.id,
            firstName: row.user.firstName,
            lastName: row.user.lastName,
            email: row.user.email,
          }
        : null,
    })),
    pagination: {
      totalItems: count,
      totalPages,
      currentPage: page,
      pageSize: limit,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
};

const markQuestionReviewed = async (questionId, adminUserId) => {
  const question = await UnansweredQuestion.findByPk(questionId);
  if (!question) {
    throw AppError.fail("Question not found", 404);
  }

  if (question.status === UNANSWERED_QUESTION_STATUS.REVIEWED) {
    return { alreadyReviewed: true };
  }

  await question.update({
    status: UNANSWERED_QUESTION_STATUS.REVIEWED,
    reviewedAt: new Date(),
    reviewedBy: adminUserId,
  });

  return question;
};



module.exports = {
  askQuestion,
  getUnansweredQuestions,
  markQuestionReviewed,
};
