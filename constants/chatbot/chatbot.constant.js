
const CHATBOT = Object.freeze({
    SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || "gazagate.support@gmail.com",
    FALLBACK_MESSAGE:
    " لا يوجداجابة على سؤالك في الوقت الحالي .يرجى الاتصال بالدعم الفني  {email}",
  });

  const CHATBOT_RECORD_TYPES = Object.freeze({
    CUSTOMER_QUESTION: "customer_question",
    SELLER_SESSION: "seller_session",
    SELLER_MESSAGE: "seller_message",
  });
  
  const UNANSWERED_QUESTION_STATUS = Object.freeze({
    PENDING: "pending",
    REVIEWED: "reviewed",
  });
  
  module.exports = {
    CHATBOT,
    CHATBOT_RECORD_TYPES,
    UNANSWERED_QUESTION_STATUS,
  }