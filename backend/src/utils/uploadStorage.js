const { v2: cloudinary } = require("cloudinary");

const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || "bjed-chauffeur";

if (!process.env.CLOUDINARY_URL && process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_URL ||
      (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
  );
}

function localUploadUrl(req, file) {
  const normalizedPath = file.path.replace(/\\/g, "/");
  const uploadIndex = normalizedPath.lastIndexOf("/uploads/");
  const publicPath = uploadIndex >= 0 ? normalizedPath.slice(uploadIndex) : `/uploads/${file.filename}`;
  return `${req.protocol}://${req.get("host")}${publicPath}`;
}

function uploadFolder(folder) {
  return [CLOUDINARY_FOLDER, folder].filter(Boolean).join("/");
}

async function resolveUploadUrl(req, file, folder) {
  const fallbackUrl = localUploadUrl(req, file);
  if (!isCloudinaryConfigured()) return fallbackUrl;

  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: uploadFolder(folder),
      resource_type: "auto",
      use_filename: true,
      unique_filename: true,
      overwrite: false,
    });
    return result.secure_url || result.url || fallbackUrl;
  } catch (error) {
    console.warn("Cloudinary upload failed; using local upload fallback:", error.message);
    return fallbackUrl;
  }
}

module.exports = {
  isCloudinaryConfigured,
  localUploadUrl,
  resolveUploadUrl,
};
