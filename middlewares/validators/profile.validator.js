const { body} = require("express-validator");
const updateProfileValidation = [

  body('email')
    .not()
    .exists()
    .withMessage('Email cannot be updated'),

  body('firstName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('First name cannot be empty')
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),

  body('lastName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Last name cannot be empty')
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),

  body('birthDate')
    .optional()
    .isISO8601()
    .withMessage('Birth date must be a valid date (YYYY-MM-DD)')
    .toDate(),

  body('gender')
    .optional()
    .isIn(['male', 'female'])
    .withMessage('Gender must be either "male" or "female"'),

  body('phone')
    .optional()
    .trim()
    .matches(/^(\+970|0)(5[0-9]{8})$/)
    .withMessage('Phone number must be a valid Palestinian number'),

  body('storeName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Store name cannot be empty')
    .isLength({ min: 2, max: 100 })
    .withMessage('Store name must be between 2 and 100 characters'),

  body('storeDescription')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Store description must not exceed 500 characters'),

  body('neighborhood')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Neighborhood cannot be empty')
    .isLength({ min: 2, max: 100 })
    .withMessage('Neighborhood must be between 2 and 100 characters'),

  body('street')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Street cannot be empty')
    .isLength({ min: 2, max: 150 })
    .withMessage('Street must be between 2 and 150 characters'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage('Address notes must not exceed 300 characters'),

];

const updatePasswordValidation=[
    body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),

  body('newPassword')
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

  body('confirmPassword')
    .custom((value, { req }) => {
      if (req.body.newPassword && value !== req.body.newPassword) {
        throw new Error('Confirm password does not match new password');
      }
      return true;
    }),

  body().custom((value, { req }) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const provided = [currentPassword, newPassword, confirmPassword].filter(
      (v) => v !== undefined && v !== ''
    );

    if (provided.length > 0 && provided.length < 3) {
      throw new Error(
        'currentPassword, newPassword, and confirmPassword are all required to change password'
      );
    }
    return true;
  }),
];


module.exports={updateProfileValidation,updatePasswordValidation}