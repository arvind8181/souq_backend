import mongoose from "mongoose";
const { Schema } = mongoose;

const WalletSchema = new Schema(
  {
    vendor_id: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      unique: true,
      index: true,
    },

    balance: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Wallet", WalletSchema);
