import {
  createImageUploadMiddleware,
  compressUploadedImages,
} from "../helpers/universal.js";

// Generate dynamic image fields for color variants
const generateAllImageFields = (
  maxColors = 10,
  maxImagesPerColor = 5,
  flatCount = 10
) => {
  const fields = [];

  // Variant (color) image fields
  for (let i = 0; i < maxColors; i++) {
    for (let j = 0; j < maxImagesPerColor; j++) {
      fields.push({ name: `color_${i}_image_${j}`, maxCount: 1 });
    }
  }

  // Flat (non-variant) image fields
  for (let k = 0; k < flatCount; k++) {
    fields.push({ name: `image_${k}`, maxCount: 1 });
  }

  return fields;
};

const ProductImg = generateAllImageFields(); // Defaults: 10 colors × 5 images = 50 fields

export const productImageUpload = [
  createImageUploadMiddleware({ fields: ProductImg, maxSizeMB: 5 }),
  compressUploadedImages,
];
