import mongoose, { Schema, model } from "mongoose";

const chatSchema = new Schema(
  {
    userOneId: { type: String, required: true },
    userTwoId: { type: String, required: true },
    orderId: { type: String, default: null }, // optional
    chatType: { type: String, enum: ["general", "order"], default: "general" },
  },
  { timestamps: true }
);

const Chat = model("Chat", chatSchema);

export default Chat;
