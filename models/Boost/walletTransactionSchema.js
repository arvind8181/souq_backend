import mongoose from "mongoose";
const { Schema } = mongoose;

const WalletTransactionSchema = new Schema(
  {
    vendor_id: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },

    reference_type: {
      type: String,
      enum: ["boost"],
      required: true,
    },

    reference_id: {
      type: Schema.Types.ObjectId,
      ref: "Boost",
      required: true,
    },

    amount: {
      type: Number, 
      required: true,
    },

    balance_after: {
      type: Number,
      required: true,
    },

    description: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model(
  "WalletTransaction",
  WalletTransactionSchema
);
