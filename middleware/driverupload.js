// middleware/driverDocsUpload.js
import {
  createImageUploadMiddleware,
  compressUploadedImages,
} from "../helpers/universal.js";

const driverDocFields = [
  { name: "idCardFront", maxCount: 1 },
  { name: "idCardBack", maxCount: 1 },
  { name: "drivingLicenseFront", maxCount: 1 },
  { name: "drivingLicenseBack", maxCount: 1 },
];

export const driverDocsUpload = [
  createImageUploadMiddleware({ fields: driverDocFields, maxSizeMB: 5 }),
  compressUploadedImages,
];
