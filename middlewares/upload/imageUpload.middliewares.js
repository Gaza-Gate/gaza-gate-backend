const multer = require("multer");
const AppError = require("../../utils/AppError.util.js");
const { IMAGE_MIME_TYPES } = require("../../constants/imageMimeTypes.constants.js");

const allowedMimeTypes = Object.values(IMAGE_MIME_TYPES);

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    return cb(null, true);
  }

  cb(new AppError("Only JPEG, PNG and WebP images are allowed.", 400));
};

const uploadConfig = (maxCount) => {
  return multer({
    storage: multer.memoryStorage(),
    fileFilter,
    limits: {
      fileSize: 5 * 1024 * 1024,
      files: maxCount,
    },
  });
};

module.exports = uploadConfig;