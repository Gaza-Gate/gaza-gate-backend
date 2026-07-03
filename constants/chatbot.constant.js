
const CHATBOT = Object.freeze({
    SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || "gazagate.support@gmail.com",
    FALLBACK_MESSAGE:
    " لا يوجداجابة على سؤالك في الوقت الحالي .يرجى الاتصال بالدعم الفني  {email}",
  });
  
  const UNANSWERED_QUESTION_STATUS = Object.freeze({
    PENDING: "pending",
    REVIEWED: "reviewed",
  });
  
  module.exports = {
    CHATBOT,
    UNANSWERED_QUESTION_STATUS,
  }