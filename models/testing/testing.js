import { Schema, model } from "mongoose";

const testingSchema = new Schema(
  {
    label: {
      type: String,
      required: true,
    },
    street: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const Testing = model("Testing", testingSchema);
export default Testing;
