const fs   = require('fs');
const path = require('path');
 
const UPLOADS_DIR = path.join(__dirname, '../uploads/products');
 

const getImageUrl = (filename) => {
  if (!filename) return null;
  return `/uploads/products/${filename}`;
};
 

const deleteImage = (filename) => {
  if (!filename) return;
  const fullPath = path.join(UPLOADS_DIR, filename);
  fs.unlink(fullPath, (err) => {
    if (err && err.code !== 'ENOENT') {
      console.error(`[ImageService] Failed to delete ${filename}:`, err.message);
    }
  });
};
 
module.exports = { getImageUrl, deleteImage };