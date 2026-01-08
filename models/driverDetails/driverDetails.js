import { Schema, model, Types } from "mongoose";

const DriverDetailSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
    FullName: {
      type: String,
      required: true,
      trim: true,
    },
    idCardFrontUrl: {
      type: String,
      trim: true,
    },
    idCardBackUrl: {
      type: String,
      trim: true,
    },
    drivingLicenseFrontUrl: {
      type: String,
      trim: true,
    },
    drivingLicenseBackUrl: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    profileComplete: {
      type: Boolean,
      default: false,
    },
    profileImage: {
      type: String,
      default: null,
    },
    mobileNumber: {
      type: String,
      trim: true,
    },
    isDelivering: {
      type: Boolean,
      default: false, // false = not delivering, true = currently delivering
    },
    isAvailable: {
      type: Boolean,
      default: true, // true = free, false = busy
    },
    vehicleType: {
      type: String,
      enum: ["bike", "van"],
    },
    driverType: {
      type: String,
      enum: ["full-time", "part-time"],
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
    },
  },
  {
    timestamps: true,
  }
);

DriverDetailSchema.index({ location: "2dsphere" });

const DriverDetail = model("DriverDetail", DriverDetailSchema);

export default DriverDetail;
