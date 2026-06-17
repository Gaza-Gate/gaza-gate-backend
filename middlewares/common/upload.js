const multer  = require('multer');
const path    = require('path');
const crypto  = require('crypto');
const AppError = require('../../utils/AppError.util');
 
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_MB   = 2;
 
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/products'));
  },
 
  filename: (req, file, cb) => {
    const ext      = path.extname(file.originalname).toLowerCase();
    const unique   = crypto.randomBytes(8).toString('hex');
    const filename = `product-${unique}${ext}`;
    cb(null, filename);
  },
});
 
const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);                                    
  } else {
    cb(new AppError().fail('Only JPEG, PNG, and WEBP images are allowed',400), false); 
  }
};
 
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },   // 2 MB hard limit
});
 
module.exports = upload;
