const AppError= require("../../utils/http/AppError.util.js");

const { query, param, body } = require('express-validator');
 
const getUsersValidation = [
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term too long'),
 
  query('role')
    .optional()
    .isIn(['customer', 'seller', 'admin'])
    .withMessage('Invalid role filter'),
 

  query('status')
    .optional()
    .isIn(['active', 'banned'])
    .withMessage('Status must be active or banned'),
 
  // pagination
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
 
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
];
 
const userIdValidation = [
  param('userId')
    .notEmpty().withMessage('User ID is required')
    .isUUID().withMessage('User ID must be a valid UUID'),
];     
 
const updateStatusValidation = [
  ...userIdValidation,
  body('status')
    .notEmpty().withMessage('Status is required')
    .isIn(['active', 'banned'])
    .withMessage('Status must be either active or banned'),
  body()
    .custom((bodyObj) => {
      const allowed   = ['status'];
      const extraKeys = Object.keys(bodyObj).filter((k) => !allowed.includes(k));
      if (extraKeys.length > 0)
        throw AppError.fail(`Unexpected fields: ${extraKeys.join(', ')}`,400);
      return true;
    }),
];
 
module.exports = { getUsersValidation, userIdValidation, updateStatusValidation };
