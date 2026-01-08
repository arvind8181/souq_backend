import mongoose, { Schema, model } from "mongoose";

const favoriteSchema = new Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CustomerDetail",
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    advertisementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Advertisement",
    },
  },
  { timestamps: true }
);

const Favorite = model("Favorite", favoriteSchema);

export default Favorite;
