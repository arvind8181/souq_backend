import { Schema, model } from "mongoose";

const UserSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    fullName: { type: String },
    role: {
      type: Number,
      required: true,
      enum: [1, 2, 3, 10, 11, 12, 13],
    },
    otp: {
      code: {
        type: String,
        default: null,
      },
      expiresAt: {
        type: Date,
        default: null,
      },
    },
    verified: {
      type: Boolean,
      default: false,
    },
    googleId: {
      type: String,
      default: null,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
    loginToken: {
      createdAt: {
        type: Date,
        default: new Date(),
      },
      deviceToken: {
        type: String,
        default: "",
      },
      deviceType: {
        type: String,
        enum: ["ios", "android"],
        default: null,
      },
    },
    notificationsEnabled: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);
UserSchema.index(
  { googleId: 1 },
  {
    unique: true,
    partialFilterExpression: { googleId: { $exists: true, $ne: null } },
  }
);
UserSchema.index({ email: 1, role: 1 }, { unique: true });
const User = model("User", UserSchema);

export default User;
