const { v2: cloudinary } = require('cloudinary');

// SDK tự đọc CLOUDINARY_URL từ environment — không cần config thủ công

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
