import mongoose from "mongoose";

const DriverCashLedgerSchema = new mongoose.Schema(
  {
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "DriverDetail", required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    amountCollected: { type: Number, required: true },
    transactionType: { type: String, enum: ["credit", "debit"], default: "credit" },
    source: { type: String, enum: ["cash_collection", "paid_to_admin", "adjustment"], required: true },
    date: { type: Date, default: Date.now },
    
    // NEW FIELDS FOR ADMIN APPROVAL
    status: { type: String, enum: ["pending", "approved"], default: "approved" },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const DriverCashLedger = mongoose.model("DriverCashLedger", DriverCashLedgerSchema);
