import jwt from "jsonwebtoken";
import multer from "multer";
import sharp from "sharp";

const jwtKey = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY;

// Generate a token
export const generateToken = (data) => {
  return jwt.sign(data, jwtKey, {
    expiresIn: JWT_EXPIRY || "1d",
  });
};

// Generate a verifying token
export const generateVerifyingToken = (data) => {
  return jwt.sign({ data, exp: JWT_EXPIRY }, jwtKey);
};

// Generate a random password
export const generateRandomPassword = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/* ── Multer Config Generator ── */
export const createImageUploadMiddleware = ({ fields, maxSizeMB = 2 }) => {
  const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (_req, file, cb) => {
      const allowed = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
      ];
      if (!allowed.includes(file.mimetype)) {
        return cb(
          new Error("Only JPG, PNG, WebP images or PDF files are allowed"),
          false
        );
      }
      cb(null, true);
    },
    limits: { fileSize: maxSizeMB * 1024 * 1024 },
  });
  return upload.fields(fields);
};

/* ── Image Compression Middleware ── */
export const compressUploadedImages = async (req, _res, next) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return next(); // No files, skip
    }

    const compressedFiles = {};

    for (const [field, files] of Object.entries(req.files)) {
      if (!Array.isArray(files) || files.length === 0) continue;

      compressedFiles[field] = await Promise.all(
        files.map(async (file) => {
          if (file.mimetype === "application/pdf") {
            // Skip compression for PDFs
            return {
              buffer: file.buffer,
              originalname: file.originalname,
              mimetype: file.mimetype,
            };
          }

          // Compress image
          const buffer = await sharp(file.buffer)
            .resize({ width: 1000 })
            .jpeg({ quality: 80 })
            .toBuffer();

          return {
            buffer,
            originalname: file.originalname.replace(/\.\w+$/, ".jpg"),
            mimetype: "image/jpeg",
          };
        })
      );
    }

    req.compressedFiles = compressedFiles;
    next();
  } catch (err) {
    next(err);
  }
};

export const extractS3Key = async (url) => {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname; 

    const segments = pathname.startsWith("/")
      ? pathname.slice(1).split("/")
      : pathname.split("/");

    segments.shift();
    const key = segments.join("/");
    return key;
  } catch {
    return null;
  }
};
