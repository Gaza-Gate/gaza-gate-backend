const {body}=require("express-validator")
const askQuestionValidator = [
    body("question")
      .trim()
      .notEmpty()
      .withMessage("Question is required")
      .isLength({ min: 3, max: 1000 })
      .withMessage("Question must be between 3 and 1000 characters"),
  ];

  module.exports = {
    askQuestionValidator,
  };
  