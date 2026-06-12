const { body } = require("express-validator");

const baseRegisterValidator = [
  body("firstName")
    .trim()
    .notEmpty()
    .withMessage("First name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters"),
  body("lastName")
    .trim()
    .notEmpty()
    .withMessage("Last name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must be between 2 and 50 characters"),
  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email format"),
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isStrongPassword({
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    })
    .withMessage("Password must contain: uppercase, lowercase, number, symbol"),
  body("confirmPassword")
    .notEmpty()
    .withMessage("Confirm password is required")
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Passwords do not match");
      }
      return true;
    }),
];

const customerLocalRegisterValidator = [...baseRegisterValidator];

const sellerLocalRegisterValidator = [
  ...baseRegisterValidator,
  body("storeName")
    .trim()
    .notEmpty()
    .withMessage("Store name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Store name must be between 2 and 100 characters"),
  body("storeDescription")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Store description must not exceed 500 characters"),
];

const verifyEmailValidator = [
  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email format"),
  body("code")
    .notEmpty()
    .withMessage("Verification code is required")
    .isLength({ min: 6, max: 6 })
    .withMessage("Code must be 6 digits")
    .isNumeric()
    .withMessage("Code must be numeric"),
];

const localLoginValidator = [
  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email format"),
  body("password").notEmpty().withMessage("Password is required"),
];

const resendVerificationCodeValidator = [
  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email format"),
];

const forgotPasswordValidator = [
  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email format"),
];

const verifyResetCodeValidator = [
  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email format"),
  body("code")
    .notEmpty()
    .withMessage("Verification code is required")
    .isLength({ min: 6, max: 6 })
    .withMessage("Code must be 6 digits")
    .isNumeric()
    .withMessage("Code must be numeric"),
];

const resetPasswordValidator = [
  body("resetToken")
    .notEmpty()
    .withMessage("Reset token is required")
    .isJWT()
    .withMessage("Invalid reset token format"),
  body("newPassword")
    .notEmpty()
    .withMessage("New password is required")
    .isStrongPassword({
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    })
    .withMessage("Password must contain: uppercase, lowercase, number, symbol"),
  body("confirmPassword")
    .notEmpty()
    .withMessage("Confirm password is required")
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error("Passwords do not match");
      }
      return true;
    }),
];

const socialLoginValidator = [
  body("token")
    .exists({ checkFalsy: true })
    .withMessage("Token is required")
    .isString()
    .withMessage("Token must be a string")
    .trim(),
];

const sellerCompleteRegistrationValidator = [
  body("pendingToken").notEmpty().withMessage("Pending token is required"),
  body("storeName")
    .notEmpty()
    .withMessage("Store name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Store name must be between 2 and 100 characters"),
  body("storeDescription")
    .notEmpty()
    .withMessage("Store description is required")
    .isLength({ min: 5, max: 500 })
    .withMessage("Store description must be between 5 and 500 characters"),
];

module.exports = {
  customerLocalRegisterValidator,
  sellerLocalRegisterValidator,
  verifyEmailValidator,
  localLoginValidator,
  resendVerificationCodeValidator,
  forgotPasswordValidator,
  verifyResetCodeValidator,
  resetPasswordValidator,
  socialLoginValidator,
  sellerCompleteRegistrationValidator,
};
