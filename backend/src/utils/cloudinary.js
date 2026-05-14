const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload Buffer lên Cloudinary.
 * @param {Buffer} buffer
 * @param {object} options - Cloudinary upload options (folder, public_id, resource_type, ...)
 * @returns {Promise<object>} Cloudinary upload result (có .secure_url)
 */
function uploadBuffer(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: 'image', ...options },
      (err, result) => (err ? reject(err) : resolve(result)),
    );
    stream.end(buffer);
  });
}

module.exports = { cloudinary, uploadBuffer };
