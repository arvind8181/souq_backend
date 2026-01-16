import { mongoose, Schema, model } from "mongoose";

const promotionSchema = new Schema(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    type: {
      type: String,
      enum: ["promotion", "flash-sale", "bundle"],
      required: true,
    },
    paidFlag: {
      type: String,
      enum: ["urgent", "featured"],
      default: null,
      required: false,
    },
    scopeType: {
      type: String,
      enum: ["category", "product"],
      default: null,
      required: false,
    },
    title: { type: String, required: true },
    description: String,
    categoryIds: [
      { type: Schema.Types.ObjectId, ref: "Category", required: true },
    ],
    productIds: [
      { type: Schema.Types.ObjectId, ref: "Product", required: true },
    ],
    discountValue: { type: Number, required: true },
    discountType: {
      type: String,
      enum: ["Fixed", "Percentage"],
      required: true,
    },
    promotionCode: { type: String },
    hours: { type: Number, default: null },
    startDate: Date,
    endDate: Date,
    isDeleted: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Promotion = model("Promotion", promotionSchema);

export default Promotion;
