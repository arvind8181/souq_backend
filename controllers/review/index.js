import JsonRes from "../../helpers/response.js";
import Review from "../../models/review/review.js";
import Product from "../../models/product/products.js";
import Order from "../../models/order/order.js";
import CustomerDetail from "../../models/customerDetails/customerDetails.js";
import mongoose from "mongoose";
import {
  getPresignedImageUrls,
  uploadImage,
} from "../../services/s3Service.js";
import { S3TYPE } from "../../utils/constant.js";



// Create Review
export const addReview = async (req, res) => {
  try {
    const { title, review, rating } = req.body;
    const { productid } = req.params;
    const userId = req.user.id;

    // ✅ Validate
    if (!mongoose.Types.ObjectId.isValid(productid)) {
      return JsonRes.conflict(res, null, "Invalid Product ID");
    }
    if (!review || !rating || !title) {
      return JsonRes.conflict(res, null, "Review, title and rating are required");
    }

    // ✅ Check product exists
    const product = await Product.findById(productid);
    if (!product) {
      return JsonRes.notFound(res, null, "Product not found");
    }

    // ✅ Get customer detail
    const customer = await CustomerDetail.findOne({ userId });
    if (!customer) {
      return JsonRes.notFound(res, null, "Customer details not found");
    }

    // ✅ Check if already reviewed
    const existingReview = await Review.findOne({
      userId: customer._id,
      productId: productid,
    });
    if (existingReview) {
      return JsonRes.conflict(res, null, "You have already reviewed this product");
    }

    // ✅ Ensure the customer actually bought & received this product
    const order = await Order.findOne({
      customerId: userId,
      "vendors.status": "delivered", // must be delivered
      "vendors.items.productId": productid, // product exists in order
    });

    if (!order) {
      return JsonRes.conflict(
        res,
        null,
        "You can only review products you have purchased and received"
      );
    }

    // ✅ Handle images
    const reviewImages = [];
    if (req.files && req.files.images) {
      for (let i = 0; i < req.files.images.length; i++) {
        const file = req.files.images[i];
        const s3Name = `${S3TYPE.REVIEW}/${userId}/${Date.now()}_${i}.jpg`;

        await uploadImage({ buffer: file.buffer, s3Name });
        reviewImages.push(s3Name);
      }
    }

    // ✅ Save review
    const newReview = new Review({
      userId: customer._id,
      productId: productid,
      title,
      review,
      rating,
      images: reviewImages,
      isReviewed: true,
    });

    const savedReview = await newReview.save();

    // ✅ Update product ratings
    await recalculateRatings(product);

    return JsonRes.dataCreated(res, savedReview, "Review added successfully");
  } catch (err) {
    console.error("Error adding review:", err);
    return JsonRes.serverError(res, err.message);
  }
};


// Get Reviews by Product ID
export const getReviewsByProductId = async (req, res) => {
  try {
    const { id: productid } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productid)) {
      return JsonRes.conflict(res, null, "Invalid Product ID");
    }

    const reviews = await Review.find({ productId: productid, isActive: true })
      .populate("userId", "FullName")
      .select("title review images rating createdAt userId reply")
      .sort({ createdAt: -1 });

    //  Fetch presigned URLs for each review's images
    const formattedReviews = await Promise.all(
      reviews.map(async (r) => {
        const presignedUrls = await getPresignedImageUrls(r.images);

        return {
          id: r._id,
          reply: r.reply,
          user: r.userId ? r.userId.FullName : null,
          title: r.title,
          review: r.review,
          images: presignedUrls,
          rating: r.rating,
          createdAt: r.createdAt,
        };
      })
    );

    return JsonRes.success(
      res,
      { reviews: formattedReviews, totalReviews: reviews.length },
      "Reviews fetched successfully"
    );
  } catch (err) {
    console.error("Error fetching reviews:", err);
    return JsonRes.serverError(res, err.message);
  }
};

export const getRatingsByProductId = async (req, res) => {
  try {
    const { id: productid } = req.params;

    const product = await Product.findById(productid).select("ratings");
    if (!product) {
      return JsonRes.notFound(res, null, "Product not found");
    }

    return JsonRes.success(
      res,
      product.ratings,
      "Ratings fetched successfully"
    );
  } catch (err) {
    console.error("Error fetching ratings:", err);
    return JsonRes.serverError(res, err.message);
  }
};

export const deleteReview = async (req, res) => {
  try {
    const { productid } = req.params;
    const userId = req.user.id;

    // Delete the review
    const deleted = await Review.findOneAndDelete({
      productId: productid,
      userId,
    });

    if (!deleted) {
      return JsonRes.notFound(res, null, "Review not found");
    }

    // Fetch the product to update ratings
    const product = await Product.findById(productid);
    if (product) {
      await recalculateRatings(product);
    }

    return JsonRes.success(res, null, "Review deleted successfully");
  } catch (err) {
    console.error("Error deleting review:", err);
    return JsonRes.serverError(res, err.message);
  }
};

// Helper to update ratings
async function recalculateRatings(product) {
  const reviews = await Review.find({ productId: product._id, isActive: true });

  // Reset ratings
  product.ratings = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, overall: 0 };

  let totalScore = 0;

  reviews.forEach((r) => {
    product.ratings[r.rating] += 1;
    totalScore += r.rating;
  });

  const totalCount = reviews.length;
  product.ratings.overall = totalCount
    ? parseFloat((totalScore / totalCount).toFixed(2))
    : 0;

  await product.save();
}

export const replyToReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { message } = req.body;
    const vendorId = req.user.id;

    // Validate review ID
    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return JsonRes.conflict(res, null, "Invalid Review ID");
    }

    if (!message || typeof message !== "string" || message.length > 500) {
      return JsonRes.conflict(
        res,
        null,
        "Reply message must be a string under 500 characters."
      );
    }

    // Find and update the review
    const updatedReview = await Review.findByIdAndUpdate(
      reviewId,
      {
        $set: {
          reply: {
            message,
            repliedAt: new Date(), // stored in UTC
            repliedBy: vendorId,
          },
        },
      },
      { new: true }
    );

    if (!updatedReview) {
      return JsonRes.notFound(res, "Review not found.");
    }

    return JsonRes.success(res, updatedReview, "Reply added successfully.");
  } catch (err) {
    console.error("Error replying to review:", err);
    return JsonRes.serverError(res, err.message);
  }
};


// fetch only the products that has review and ratings.
export const getOnlyProductsWithReviewsAndRatings = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', sort = 'latest' } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const matchStage = {
      'ratings.overall': { $gt: 0 },
      $or: [{ productName: { $regex: new RegExp(search, 'i') } }],
    }

    const sortStage = (() => {
      switch (sort) {
        case 'latest':
          return { createdAt: -1 }
        case 'oldest':
          return { createdAt: 1 }
        case 'highrating':
          return { 'ratings.overall': -1 }
        case 'lowrating':
          return { 'ratings.overall': 1 }
        default:
          return { createdAt: -1 }
      }
    })();

    const pipeline = [
      { $match: matchStage },

      {
        $lookup: {
          from: 'reviews',
          localField: '_id',
          foreignField: 'productId',
          as: 'reviews',
        },
      },
      {
        $unwind: '$reviews',
      },
      {
        $lookup: {
          from: 'customerdetails',
          localField: 'reviews.userId',
          foreignField: '_id',
          as: 'reviewCustomer',
        },
      },
      {
        $addFields: {
          'reviews.userFullName': {
            $arrayElemAt: ['$reviewCustomer.FullName', 0],
          },
          'reviews.userProfileImage': {
            $arrayElemAt: ['$reviewCustomer.profileImage', 0],
          },
        },
      },
      {
        $group: {
          _id: '$_id',
          productName: { $first: '$productName' },
          price: { $first: '$price' },
          discountedprice: { $first: '$discountedprice' },
          ratings: { $first: '$ratings' },
          createdAt: { $first: '$createdAt' },
          variants: { $first: '$variants' },
          images: { $first: '$images' },
          reviews: { $push: '$reviews' },
        },
      },
      {
        $addFields: {
          reviewsCount: { $size: '$reviews' },
        },
      },
      { $sort: sortStage }, // ✅ Apply sorting here
    ]

    const products = await Product.aggregate([
      ...pipeline,
      {
        $project: {
          productName: 1,
          price: 1,
          discountedprice: 1,
          ratings: 1,
          reviews: 1,
          variants: 1,
          images: 1,
          reviewsCount: 1,
          createdAt: 1,
        },
      },
      { $skip: skip },
      { $limit: parseInt(limit) },
    ])

    const totalResult = await Product.aggregate([
      ...pipeline,
      { $count: 'total' },
    ])
    const totalProducts = totalResult[0]?.total || 0

    const allImageKeys = []
    for (const product of products) {
      if (product.images?.length) {
        allImageKeys.push(...product.images)
      }

      if (product.variants?.length) {
        for (const variant of product.variants) {
          if (variant.images?.length) {
            allImageKeys.push(...variant.images)
          }
        }
      }

      for (const review of product.reviews) {
        if (review.userProfileImage) {
          allImageKeys.push(review.userProfileImage)
        }
      }
    }

    const signedUrlsMap = {}
    if (allImageKeys.length > 0) {
      const signedUrls = await getPresignedImageUrls(allImageKeys)
      allImageKeys.forEach((key, idx) => {
        signedUrlsMap[key] = signedUrls[idx]
      })
    }

    for (const product of products) {
      if (product.images?.length) {
        product.images = product.images.map((img) => signedUrlsMap[img] || img)
      }

      if (product.variants?.length) {
        product.variants = product.variants.map((variant) => {
          if (variant.images?.length) {
            const signed = variant.images.map((img) => signedUrlsMap[img] || img)
            return { ...variant, images: signed }
          }
          return variant
        })
      }

      if (product.reviews?.length) {
        product.reviews = product.reviews.map((review) => {
          if (review.userProfileImage && signedUrlsMap[review.userProfileImage]) {
            return {
              ...review,
              userProfileImage: signedUrlsMap[review.userProfileImage],
            }
          }
          return review
        })
      }
    }

    return JsonRes.success(
      res,
      {
        data: products,
        totalProducts,
      },
      'Products with reviews and ratings fetched successfully'
    )
  } catch (err) {
    console.error('Error fetching reviewed products:', err)
    return JsonRes.serverError(res, err.message || 'Internal server error')
  }
}






