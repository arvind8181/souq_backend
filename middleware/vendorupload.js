// middleware/driverDocsUpload.js
import {
  createImageUploadMiddleware,
  compressUploadedImages,
} from "../helpers/universal.js";

const VendorDocFields = [
  { name: "License", maxCount: 1 },
  { name: "profilePicture", maxCount: 1 },
];

export const VendorDocsUpload = [
  createImageUploadMiddleware({ fields: VendorDocFields, maxSizeMB: 5 }),
  compressUploadedImages,
];

export const validateRequest = (req, res, next) => {
  try {
    // Parse location if it's a JSON string
    if (typeof req.body.location === "string") {
      req.body.location = JSON.parse(req.body.location);
    }

    // Parse address if it's a JSON string
    if (typeof req.body.address === "string") {
      req.body.address = JSON.parse(req.body.address);
    }

    // Parse category if it's a JSON string
    if (typeof req.body.category === "string") {
      req.body.category = JSON.parse(req.body.category);
    }

    console.log("Parsed req.body:", req.body);
    next();
  } catch (err) {
    return res.status(400).json({
      message: "Invalid JSON in location, address, or category",
      error: err.message,
    });
  }
};
