import mongoose from "mongoose";

const boostPricingSchema = new mongoose.Schema(
  {
    boostType: {
      type: String,
      enum: ["featured", "top", "notification"],
      required: true,
      unique: true,
    },
    pricePerDay: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true }
);

// ✅ Compile model FIRST (this was missing)
const BoostPricing = mongoose.model("BoostPricing", boostPricingSchema);

// 🔹 Auto-seed default boost pricing if none exist
const seedDefaultBoostPricing = async () => {
  try {
    const count = await BoostPricing.countDocuments();

    if (count === 0) {
      await BoostPricing.insertMany([
        { boostType: "featured", pricePerDay: 0 },
        { boostType: "top", pricePerDay: 0 },
        { boostType: "notification", pricePerDay: 0 },
      ]);
      console.log("✅ Default Boost Pricing seeded");
    }
  } catch (err) {
    console.error("❌ Error seeding Boost Pricing:", err);
  }
};

// ✅ Run seed AFTER model exists
seedDefaultBoostPricing();

export default BoostPricing;
