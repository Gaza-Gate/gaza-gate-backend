const { param } = require("express-validator");

const getProductMetaValidator = [
  param("id").isUUID().withMessage("Invalid product ID"),
];

const getStoreMetaValidator = [
  param("sellerId").isUUID().withMessage("sellerId must be a valid UUID"),
];

module.exports = {
  getProductMetaValidator,
  getStoreMetaValidator,
};
