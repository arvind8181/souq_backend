import { mongoose, Schema, model } from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";
import mongoose_delete from "mongoose-delete";
import aggregatePaginate from "mongoose-aggregate-paginate-v2";

const reviewSchema = new Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CustomerDetail",
      required: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 100,
    },
    review: {
      type: String,
      required: true,
      maxlength: 500,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    images: {
      type: [String],
      default: [],
    },
    reply: {
      message: {
        type: String,
        maxlength: 500,
      },
      repliedAt: {
        type: Date,
      },
      repliedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "VendorDetail", // or 'User' if vendors are in the same model
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isReviewed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

reviewSchema.plugin(mongoosePaginate);
reviewSchema.plugin(aggregatePaginate);
reviewSchema.plugin(mongoose_delete, { overrideMethods: true });

const Review = model("Review", reviewSchema);

export default Review;
