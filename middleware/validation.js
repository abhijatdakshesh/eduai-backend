const { body, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg
      }))
    });
  }
  next();
};

const validateRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  
  body('confirm_password')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    }),
  
  body('first_name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  
  body('last_name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  
  body('user_type')
    .isIn(['student', 'teacher', 'admin'])
    .withMessage('User type must be student, teacher, or admin'),
  
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  
  body('date_of_birth')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date of birth'),
  
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be male, female, or other'),
  
  body('terms_accepted')
    .isBoolean()
    .custom((value) => {
      if (!value) {
        throw new Error('You must accept the terms and conditions');
      }
      return true;
    }),
  
  body('privacy_policy_accepted')
    .isBoolean()
    .custom((value) => {
      if (!value) {
        throw new Error('You must accept the privacy policy');
      }
      return true;
    }),
  
  body('marketing_consent')
    .optional()
    .isBoolean(),
  
  handleValidationErrors
];

const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  handleValidationErrors
];

const validateEmailVerification = [
  body('verification_token')
    .notEmpty()
    .withMessage('Verification token is required'),
  
  handleValidationErrors
];

const validateForgotPassword = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  handleValidationErrors
];

const validateResetPassword = [
  body('reset_token')
    .notEmpty()
    .withMessage('Reset token is required'),
  
  body('new_password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  
  body('confirm_password')
    .custom((value, { req }) => {
      if (value !== req.body.new_password) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    }),
  
  handleValidationErrors
];

const validateRefreshToken = [
  body('device_id')
    .notEmpty()
    .withMessage('Device ID is required'),
  
  handleValidationErrors
];

const validateLogout = [
  body('device_id')
    .notEmpty()
    .withMessage('Device ID is required'),
  
  body('logout_all_sessions')
    .optional()
    .isBoolean(),
  
  handleValidationErrors
];

module.exports = {
  validateRegistration,
  validateLogin,
  validateEmailVerification,
  validateForgotPassword,
  validateResetPassword,
  validateRefreshToken,
  validateLogout,
  handleValidationErrors
}; 