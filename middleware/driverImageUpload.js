import {
  createImageUploadMiddleware,
  compressUploadedImages,
} from "../helpers/universal.js";

export const driverImageUpload = [
  createImageUploadMiddleware({
    fields: [{ name: "profileImage", maxCount: 1 }], 
    maxSizeMB: 5,
  }),
  compressUploadedImages,
];
