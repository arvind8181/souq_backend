import mongoose, { Schema, model } from "mongoose";

const notificationSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Name of the User model
      required: true,
    },
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SomeModel', // Replace with the related model name
      required: false,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['info', 'warning', 'success', 'error'], // Optional categorization
      default: 'info',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // Adds createdAt & updatedAt
  }
);


const Notification = model('Notification', notificationSchema);

export default Notification;

