import {
  createImageUploadMiddleware,
  compressUploadedImages,
} from "../helpers/universal.js";

export const advertisementImageUpload = [
  createImageUploadMiddleware({
    fields: [{ name: "images", maxCount: 10 }], // Single field: images[]
    maxSizeMB: 5, // Max size per image in MB
  }),
  compressUploadedImages,
];
