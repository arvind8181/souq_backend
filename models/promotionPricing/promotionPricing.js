// models/promotionPricing/promotionPricing.js
import mongoose, { Schema, model } from "mongoose";

const promotionPricingSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["promotion", "flash-sale", "bundle"],
      required: true,
      unique: true, // only one record per type
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    pricingType: {
      type: String,
      enum: [
        "weekly",
        "monthly",
        "yearly",
        "one-time",
        "lifetime",
        "per-use",
        "daily",
        "hourly",
        "free",
      ],
      required: true,
      default: "weekly",
    },
  },
  { timestamps: true }
);

const PromotionPricing = model("PromotionPricing", promotionPricingSchema);

// 🔹 Auto-seed default promotion pricing if none exist
const seedDefaultPromotionPricing = async () => {
  try {
    const count = await PromotionPricing.countDocuments();
    if (count === 0) {
      await PromotionPricing.insertMany([
        { type: "promotion", price: 0, pricingType: "free" },
        { type: "flash-sale", price: 0, pricingType: "weekly" },
        { type: "bundle", price: 0, pricingType: "weekly" },
      ]);
      console.log("✅ Default Promotion Pricing seeded");
    }
  } catch (err) {
    console.error("❌ Error seeding Promotion Pricing:", err);
  }
};

// Run seed after model is compiled
seedDefaultPromotionPricing();

export default PromotionPricing;
