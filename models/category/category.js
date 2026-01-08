import mongoose, { Schema, model } from "mongoose";

const categorySchema = new Schema(
  {
    category: {
      type: String,
      required: true,
      unique: true,
    },
    subCategory: [
      {
        type: String,
        required: true,
      },
    ],
    color: {
      type: Boolean,
      default: false,
    },
    commission: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const Category = model("Category", categorySchema);

export default Category;
