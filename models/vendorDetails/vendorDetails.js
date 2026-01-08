import { Schema, model, Types } from "mongoose";
import { CATEGORY_OPTIONS } from "../../utils/constant.js";
const VendorDetailSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
    businessName: {
      type: String,
      required: false,
      default: null,
      trim: true,
    },
    ownerName: {
      type: String,
      required: false,
      default: null,
      trim: true,
    },
    commercialRegNo: {
      type: String,
      required: false,
      default: null,
      trim: true,
    },
    vatOrTaxId: {
      type: String,
      default: null,
      trim: true,
    },
    nationalIdNumber: {
      type: String,
      required: false,
      default: null,
      trim: true,
    },
    businessPhone: {
      type: String,
      required: false,
      default: null,
      trim: true,
    },
    whatsappNumber: {
      type: String,
      default: null,
      trim: true,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0], // Optional: set default here if always needed
      },
    },
    address: {
      street: { type: String, required: false, default: null },
      city: { type: String, required: false, default: null },
      state: { type: String, required: false, default: null },
      country: { type: String, required: false, default: null },
    },
    profilePicture: {
      type: String, // file path or URL
      default: null,
    },
    category: {
      type: [String],
      enum: CATEGORY_OPTIONS,
      default: [],
    },

    licenseDocument: {
      type: String,
      required: false,
      default: null,
    },
    bankOrMobilePayInfo: {
      type: String,
      default: null,
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
    // ✅ Premium fields
    isPremium: {
      type: Boolean,
      default: false,
    },
    hasAppliedForPremium: {
      type: Boolean,
      default: false, 
    },
    premiumPlan: {
      type: String,
      enum: ["Monthly", "Quarterly", "Yearly"],
      default: null,
    },
    premiumStartDate: {
      type: Date,
      default: null,
    },
    premiumEndDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Add 2dsphere index for geospatial queries
VendorDetailSchema.index({ location: "2dsphere" });

const VendorDetail = model("VendorDetail", VendorDetailSchema);

export default VendorDetail;
