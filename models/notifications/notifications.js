import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: Number, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    data: { type: Object, default: {} },
    deviceToken: { type: String },
    deviceType: { type: String },
    status: { type: String, enum: ["pending", "sent", "failed"], default: "pending" },
  },
  { timestamps: true }
);

// ✅ Prevent OverwriteModelError
export default mongoose.models.Notifications ||
  mongoose.model("Notifications", notificationSchema);
