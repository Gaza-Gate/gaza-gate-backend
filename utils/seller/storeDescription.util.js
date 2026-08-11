const AppError = require("../http/AppError.util.js");

const normalizeStoreDescription = (value) => {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
};

/** Normalize blanks to null; throw 400 if a non-empty value is out of range. */
const prepareStoreDescription = (value) => {
  const normalized = normalizeStoreDescription(value);
  if (
    normalized != null &&
    (normalized.length < 5 || normalized.length > 500)
  ) {
    throw AppError.fail(
      "Store description must be between 5 and 500 characters",
      400,
    );
  }
  return normalized;
};

module.exports = { normalizeStoreDescription, prepareStoreDescription };
