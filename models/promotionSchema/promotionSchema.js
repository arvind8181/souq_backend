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
    title: { type: String, required: true },
    description: String,
    discountPercentage: { type: Number, required: true, min: 1, max: 100 },
    promotionCode: { type: String },
    productIds: [
      { type: Schema.Types.ObjectId, ref: "Product", required: true },
    ],
    hours: { type: Number, default: null }, // Only for flash-sale
    startDate: Date,
    endDate: Date,
    isDeleted: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Promotion = model("Promotion", promotionSchema);

export default Promotion;
