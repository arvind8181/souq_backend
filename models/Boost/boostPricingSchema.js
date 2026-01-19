import mongoose from "mongoose";
const { Schema } = mongoose;

const BoostSchema = new Schema(
  {
    vendor_id: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },

    boost_type: {
      type: String,
      enum: ["featured", "top_of_list", "highlight"],
      required: true,
      index: true,
    },

    scope_type: {
      type: String,
      enum: ["product", "category"],
      required: true,
    },

    scope_ids: [
      {
        type: Schema.Types.ObjectId,
        required: true,
        index: true,
      },
    ],

    start_date: {
      type: Date,
      required: true,
      index: true,
    },

    end_date: {
      type: Date,
      index: true,
    },

    duration: {
      value: {
        type: Number,
        required: true,
      },
      unit: {
        type: String,
        enum: ["days", "hours"],
        default: "days",
      },
    },

    price: {
      type: Number,
      required: true,
    },

    priority: {
      type: Number,
      default: 0,
      index: true,
    },

    status: {
      type: String,
      enum: ["draft", "scheduled", "active", "expired", "stopped"],
      default: "draft",
      index: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

BoostSchema.index({ vendor_id: 1, status: 1 });
BoostSchema.index({ boost_type: 1, status: 1 });
BoostSchema.index({ scope_ids: 1, status: 1 });
BoostSchema.index({ start_date: 1, end_date: 1 });

export default mongoose.model("Boost", BoostSchema);
