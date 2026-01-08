import mongoose from "mongoose";

const VendorDeliveryHourSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    day: {
      type: String,
      enum: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      required: true,
    },
    isDayOff: {
      type: Boolean,
      default: false,
    },
    openTime: {
      type: Date,
      required: function () {
        return !this.isDayOff;
      },
    },
    closeTime: {
      type: Date,
      required: function () {
        return !this.isDayOff;
      },
    },
  },
  { timestamps: true }
);

// Ensure only one entry per vendor per day
VendorDeliveryHourSchema.index({ vendorId: 1, day: 1 }, { unique: true });

const VendorDeliveryHour = mongoose.model(
  "VendorDeliveryHour",
  VendorDeliveryHourSchema
);

export default VendorDeliveryHour;
