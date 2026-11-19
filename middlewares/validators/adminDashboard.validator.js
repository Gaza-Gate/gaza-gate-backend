const { query } = require("express-validator");

const getAdminDashboardValidation = [
  query("months")
    .optional()
    .isInt({ min: 1, max: 24 })
    .withMessage("months must be an integer between 1 and 24")
    .toInt(),
  query("recentLimit")
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage("recentLimit must be an integer between 1 and 20")
    .toInt(),
];

module.exports = {
  getAdminDashboardValidation,
};
