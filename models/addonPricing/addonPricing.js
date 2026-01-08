// models/AddonPricing.js
import { Schema, model } from "mongoose";

const AddonPricingSchema = new Schema(
  {
    addonName: {
      type: String,
      required: true,
      enum: [
        "Featured Ad",
        "Search Boost",
        "Push Notification",
        "Extend Ad Life",
        "Extra Photo Pack",
        "Premium Badge",
      ],
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    days: {
      type: Number, // optional
      default: null,
    },
    pricingType: {
      type: String, // e.g. "per_push", "per_photo", "lifetime"
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const AddonPricing = model("AddonPricing", AddonPricingSchema);

// 🔹 Auto-seed default addon pricing if none exist
const seedDefaultAddonPricing = async () => {
  try {
    const count = await AddonPricing.countDocuments();
    if (count === 0) {
      await AddonPricing.insertMany([
        { addonName: "Featured Ad", price: 0, days: 0 },
        { addonName: "Search Boost", price: 0, days: 0 },
        { addonName: "Push Notification", price: 0, pricingType: "one_time" },
        { addonName: "Extend Ad Life", price: 0, days: 0 },
        { addonName: "Extra Photo Pack", price: 0, pricingType: "one_time" },
        { addonName: "Premium Badge", price: 0, pricingType: "until_expiration" },
      ]);
      console.log("✅ Default Addon Pricing seeded");
    }
  } catch (err) {
    console.error("❌ Error seeding Addon Pricing:", err);
  }
};

// Run seed after model is compiled
seedDefaultAddonPricing();

export default AddonPricing;