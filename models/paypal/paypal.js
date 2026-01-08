import mongoose from "mongoose";

const paypalWebhookEventSchema = new mongoose.Schema(
  {
    event: {
      type: Object,
      required: true,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { collection: "paypalWebhookEvents" }
);

const PaypalWebhookEvent = mongoose.model(
  "PaypalWebhookEvent",
  paypalWebhookEventSchema
);

export default PaypalWebhookEvent;
