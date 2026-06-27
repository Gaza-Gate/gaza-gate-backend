const { body,param } = require("express-validator");
const orderStatus = require("../../constants/orderStatuses.constant");
const ORDER_STATUSES={
  PENDING_REVIEW: orderStatus.PENDING_REVIEW,
  ACCEPTED:orderStatus.PENDING_REVIEW,
  REJECTED:orderStatus.REJECTED,
  IN_PRODUCTION:  orderStatus.IN_PRODUCTION,
  READY:orderStatus.READY,
  COMPLETED:orderStatus.COMPLETED,
  CANCELLED:orderStatus.CANCELLED
}


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
    .optional()
    .notEmpty()
    .withMessage('Current password is required'),

  body('newPassword')
    .optional()
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/\d/)
    .withMessage('New password must contain at least one number'),

  body('confirmPassword')
    .optional()
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
]





const createProductValidation = [

  body('name')
    .notEmpty()
    .withMessage('Product name is required')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Product name must be between 2 and 100 characters'),


  body('price')
    .notEmpty()
    .withMessage('Price is required')
    .isFloat({ gt: 0 })
    .withMessage('Price must be a number greater than 0')
    .toFloat(),

 /* body('categoryId')
    .notEmpty()
    .withMessage('Category name is required')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Category name must be between 2 and 100 characters'),
    */

  
  body('stockType')
    .notEmpty()
    .withMessage('Stock type is required')
    .isIn(['limited', 'unlimited'])
    .withMessage('Stock type must be either "limited" or "unlimited"'),

  body('quantity')
    .if(body('stockType').equals('limited'))
    .notEmpty()
    .withMessage('Quantity is required when stock type is "limited"')
    .isInt({ gt: 0 })
    .withMessage('Quantity must be a whole number greater than 0')
    .toInt(),

  body('quantity')
    .if(body('stockType').equals('unlimited'))
    .custom((value) => {
      if (value !== undefined && value !== null && value !== '') {
        throw new Error('Quantity must not be provided when stock type is "unlimited"');
      }
      return true;
    }),

  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['active', 'hidden'])
    .withMessage('Status must be either "active" or "hidden"'),

  body('image').custom((value, { req }) => {
   if (!req.file) {
      throw new Error('Product image is required');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      throw new Error('Image must be a JPEG, PNG, or WEBP file');
    }

    const maxSizeInBytes = 2 * 1024 * 1024; // 2MB
    if (req.file.size > maxSizeInBytes) {
      throw new Error('Image size must not exceed 2MB');
    }

    return true;
  }),
];

const updateProductValidation = [
 
  param('productId')
    .notEmpty()
    .withMessage('Product ID is required')
    .isUUID()
    .withMessage('Product ID must be a valid UUID'),
 
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Product name cannot be empty')
    .isLength({ min: 2, max: 100 })
    .withMessage('Product name must be between 2 and 100 characters'),
 
  body('price')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('Price must be a number greater than 0')
    .toFloat(),
 
  body('categoryName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Category cannot be empty'),
 
  body('stockType')
    .optional()
    .isIn(['limited', 'unlimited'])
    .withMessage('Stock type must be either "limited" or "unlimited"'),
 
  body('quantity')
    .if(body('stockType').equals('limited'))
    .notEmpty()
    .withMessage('Quantity is required when stock type is "limited"')
    .isInt({ gt: 0 })
    .withMessage('Quantity must be a whole number greater than 0')
    .toInt(),
 
  body('quantity')
    .if(body('stockType').equals('unlimited'))
    .custom((value) => {
      if (value !== undefined && value !== null && value !== '') {
        throw new Error('Quantity must not be provided when stock type is "unlimited"');
      }
      return true;
    }),
 
  body('status')
    .optional()
    .isIn(['active', 'hidden'])
    .withMessage('Status must be either "active" or "hidden"'),
];

const updateOrderStatus=[
  param('orderId')
    .notEmpty()
    .withMessage('Order ID is required')
    .isUUID()
    .withMessage('Order ID must be a valid UUID'),
 
 
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(ORDER_STATUSES)
    .withMessage(
      `Status must be one of: ${ORDER_STATUSES}`
    ),
]

module.exports = { 
  updateProfileValidation,
  updatePasswordValidation,
  createProductValidation,
  updateProductValidation,
  updateOrderStatus

 };
