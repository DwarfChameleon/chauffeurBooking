const fs = require("fs/promises");

if (process.env.CLOUDINARY_URL) {
  process.env.CLOUDINARY_URL = process.env.CLOUDINARY_URL
    .trim()
    .replace(/^CLOUDINARY_URL\s*=\s*/i, "")
    .replace(/^['"]|['"]$/g, "");
}

const { v2: cloudinary } = require("cloudinary");

const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || "bjed-chauffeur";

configureCloudinary();

function configureCloudinary() {
  if (process.env.CLOUDINARY_URL) {
    const credentials = parseCloudinaryUrl(process.env.CLOUDINARY_URL);
    if (credentials) {
      cloudinary.config({ ...credentials, secure: true });
      return;
    }
  }

  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }
}

function parseCloudinaryUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "cloudinary:") return null;
    return {
      cloud_name: url.hostname,
      api_key: decodeURIComponent(url.username),
      api_secret: decodeURIComponent(url.password),
    };
  } catch {
    return null;
  }
}

function configuredCloudName() {
  return cloudinary.config().cloud_name || process.env.CLOUDINARY_CLOUD_NAME || "";
}

function uploadStorageError(message, cause) {
  const error = new Error(message);
  error.status = 502;
  error.cause = cause;
  return error;
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
    const uploadUrl = result.secure_url || result.url;
    if (!uploadUrl) throw new Error("Cloudinary did not return a file URL.");
    await fs.unlink(file.path).catch(() => undefined);
    return uploadUrl;
  } catch (error) {
    console.error("Cloudinary upload failed:", {
      message: error.message,
      cloudName: configuredCloudName() || "missing",
      folder: uploadFolder(folder),
    });
    throw uploadStorageError("Cloudinary upload failed. Please check the Cloudinary environment variables and try again.", error);
  }
}

module.exports = {
  configuredCloudName,
  isCloudinaryConfigured,
  localUploadUrl,
  resolveUploadUrl,
};
