// models/Commission.js
import { Schema, model } from "mongoose";

const DriverCommissionSchema = new Schema(
  {
    driverType: {
      type: String,
      required: true,
      enum: ["full_time", "part_time"],
    },
    vehicle: {
      type: String,
      required: true,
      enum: ["van", "bike"],
    },
    commissionPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

const DriverCommission = model("DriverCommission", DriverCommissionSchema);

// 🔹 Auto-seed default commissions if none exist
const seedDefaultCommissions = async () => {
  try {
    const count = await DriverCommission.countDocuments();
    if (count === 0) {
      await DriverCommission.insertMany([
        { driverType: "full_time", vehicle: "van", commissionPercentage: 0 },
        { driverType: "full_time", vehicle: "bike", commissionPercentage: 0 },
        { driverType: "part_time", vehicle: "van", commissionPercentage: 0 },
        { driverType: "part_time", vehicle: "bike", commissionPercentage: 0 },
      ]);
      console.log("✅ Default commissions seeded");
    }
  } catch (err) {
    console.error("❌ Error seeding default commissions:", err);
  }
};

// Run seed after model is compiled
seedDefaultCommissions();

export default DriverCommission;
