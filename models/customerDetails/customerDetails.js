import { Schema, model, Types } from "mongoose";

const CustomerDetailSchema = new Schema(
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
    profileImage: {
      type: String,
      default: null,
    },
    mobileNumber: {
      type: String,
      trim: true,
    },
    gender: {
      type: String,
      enum: ["male", "female"],
    },
  },
  {
    timestamps: true,
  }
);

// Add 2dsphere index for geospatial queries

const CustomerDetail = model("CustomerDetail", CustomerDetailSchema);

export default CustomerDetail;
