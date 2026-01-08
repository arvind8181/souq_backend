import { Schema, model, Types } from "mongoose";
import {
  CATEGORY_ENUM,
  SUBCATEGORY_ENUM,
  ratingsSchema,
} from "../../utils/constant.js";

// Variant schema: color-wise image grouping
const variantSchema = new Schema({
  colorName: { type: String, required: true },
  colorCode: { type: String, required: true },
  images: { type: [String], default: [] },
});

const ProductSchema = new Schema(
  {
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    highlight: {
      type: String, // changed from array to HTML string
      default: "",
    },
    overview: {
      type: String,
      trim: true,
      default: "",
    },
    specifications: {
      type: String, // changed from Map to HTML string
      default: "",
    },
    category: {
      type: Types.ObjectId, // Store Category document ID
      ref: "Category", // Reference to Category model
      required: true,
    },
    subCategory: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    discountedprice: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
    },
    unit: {
      type: String,
      required: true,
      enum: [
        "kg",
        "g",
        "piece",
        "L",
        "ml",
        "box",
        "pack",
        "bottle",
        "tablet",
        "capsule",
      ],
      trim: true,
    },
    stockQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    productType: {
      type: String,
      enum: ["1", "2"],
      required: true,
    },
    sizes: {
      type: [String],
      default: [],
    },
    images: {
      type: [String],
      default: [],
    },
    variants: {
      type: [variantSchema],
      default: [],
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    isCODAvailable: {
      type: Boolean,
      default: false,
    },
    tags: {
      type: [String],
      default: [],
    },
    deleted: {
      type: Boolean,
      default: false,
    },
    vendorId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
    dimensions: {
      length: { type: Number, min: 0, default: 0 },
      width: { type: Number, min: 0, default: 0 },
      height: { type: Number, min: 0, default: 0 },
      unit: {
        type: String,
        enum: ["cm", "m", "in", "ft"],
        default: "cm",
      },
    },
    ratings: ratingsSchema,
  },
  {
    timestamps: true,
  }
);

const Product = model("Product", ProductSchema);

export default Product;
