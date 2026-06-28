const { Readable } = require("stream");
const cloudinary = require("../config/cloudinary.config");

const uploadImage = (buffer, folder = "avatars") => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
      },
      (error, result) => {
        if (error) return reject(error);

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    Readable.from(buffer).pipe(uploadStream);
  });
};

const deleteImage = async (publicId) => {
  if (!publicId) return null;
  return cloudinary.uploader.destroy(publicId);
};

const uploadManyImages = async (files, folder = "products") => {
  const uploaded = [];

  for (const file of files) {
    const result = await uploadImage(file.buffer, folder);
    uploaded.push(result);
  }

  return uploaded;
};

module.exports = {
  uploadImage,
  uploadManyImages,
  deleteImage,
};