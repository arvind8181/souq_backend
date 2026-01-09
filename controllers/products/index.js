import JsonRes from "../../helpers/response.js";
import VendorDetail from "../../models/vendorDetails/vendorDetails.js";
import Product from "../../models/product/products.js";
import Favorite from "../../models/favourite/favourite.js";
import CustomerDetail from "../../models/customerDetails/customerDetails.js";
import Cart from "../../models/cart/cart.js";
import Review from "../../models/review/review.js";
import Category from "../../models/category/category.js";
import { ROLES,S3TYPE } from "../../utils/constant.js";
import mongoose from "mongoose";
import axios from "axios";
import {
  uploadImage,
  getPresignedImageUrls,
  deleteObject,
} from "../../services/s3Service.js";
import { extractS3Key } from "../../helpers/universal.js";
const {
  badRequest,
  conflict,
  success,
  serverError,
  failed,
  dataCreated,
  notFound,
  unauthorized,
} = JsonRes;

export const createProduct = async (req, res) => {
  try {
    const {
      productName,
      description,
      category,
      subCategory,
      price,
      discount = 0,
      quantity,
      unit,
      stockQuantity,
      productType,
      isAvailable,
      isCODAvailable,
      tags,
      sizes,
      highlights,
      overview,
      specifications,
      colors, // may or may not be used
      dimensions, // ✅ new
    } = req.body;

    const parsedTags = typeof tags === "string" ? JSON.parse(tags) : tags;
    const parsedSizes = typeof sizes === "string" ? JSON.parse(sizes) : sizes;
    const parsedColors =
      typeof colors === "string" ? JSON.parse(colors) : colors;

    const parsedDimensions =
      typeof dimensions === "string" ? JSON.parse(dimensions) : dimensions;

    const userId = req.user.id;
    const vendor = await VendorDetail.findOne({ userId });
    if (!vendor) return badRequest(res, null, "Vendor profile not found.");

    const numericPrice = parseFloat(price);
    const numericDiscount = parseFloat(discount);
    const discountedprice = Math.max(
      0,
      numericPrice - (numericPrice * numericDiscount) / 100
    ).toFixed(2);

    const productImages = [];
    const variants = [];
    const fileFields = req.compressedFiles || {};

    // CASE 1: Flat images
    if (fileFields.image_0 || fileFields.image_1 || fileFields.image_2) {
      for (let i = 0; i < 10; i++) {
        const fileKey = `image_${i}`;
        const file = fileFields[fileKey]?.[0];
        if (file) {
          const s3Name = `${
            S3TYPE.PRODUCT
          }/${userId}/${Date.now()}_main_${i}.jpg`;
          await uploadImage({ buffer: file.buffer, s3Name });
          productImages.push(s3Name);
        }
      }
    }

    // CASE 2: Variants
    if (
      !productImages.length &&
      Array.isArray(parsedColors) &&
      parsedColors.length > 0
    ) {
      for (let i = 0; i < parsedColors.length; i++) {
        const colorObj = parsedColors[i];
        const variantImages = [];

        for (let j = 0; j < colorObj.imageCount; j++) {
          const fileKey = `color_${i}_image_${j}`;
          const file = fileFields[fileKey]?.[0];
          if (file) {
            const s3Name = `${
              S3TYPE.PRODUCT
            }/${userId}/${Date.now()}_${i}_${j}.jpg`;
            await uploadImage({ buffer: file.buffer, s3Name });
            variantImages.push(s3Name);
          }
        }

        variants.push({
          colorName: colorObj.colorName,
          colorCode: colorObj.colorCode,
          images: variantImages,
        });
      }
    }

    const product = await Product.create({
      productName,
      description,
      category,
      subCategory,
      price: numericPrice,
      discount: numericDiscount,
      discountedprice,
      quantity,
      productType,
      unit,
      stockQuantity,
      isAvailable,
      isCODAvailable,
      tags: parsedTags,
      sizes: parsedSizes,
      highlight: highlights,
      overview,
      specifications,
      vendorId: vendor.userId,
      variants,
      images: productImages,
      dimensions: parsedDimensions, // ✅ added
    });

    return dataCreated(res, product, "Product created successfully.");
  } catch (err) {
    console.error("Product creation error:", err);
    return serverError(res, err, "Failed to create product.");
  }
};

// export const getProducts = async (req, res) => {
//   try {
//     /* -------------------------------------------------------------- */
//     /* 1️⃣  Which source are we reading params from?                   */
//     /*    ─ GET  (vendor) → req.query                                 */
//     /*    ─ POST (admin)  → req.body                                  */
//     /* -------------------------------------------------------------- */
//     const src = req.method === "POST" ? req.body : req.query;

//     const {
//       page = 1,
//       pageSize = 10,
//       sortKey = "createdAt",
//       sortDirection = "desc",
//       search, // 👈 new param (search in productName)
//       categoryName, // 👈 new param (filter by category name)
//     } = src;

//     const pageNum = parseInt(page, 10);
//     const limit = parseInt(pageSize, 10);
//     const skip = (pageNum - 1) * limit;
//     const sort = { [sortKey]: sortDirection.toLowerCase() === "asc" ? 1 : -1 };

//     /* -------------------------------------------------------------- */
//     /* Build Mongo filter                                             */
//     /* -------------------------------------------------------------- */
//     const filter = { deleted: false };

//     // Vendor restriction
//     if (req.user.role === ROLES.VENDOR) {
//       filter.vendorId = req.user.id;
//     } else if (req.user.role === ROLES.ADMIN) {
//       if (src.vendorId) filter.vendorId = src.vendorId;
//     }

//     // 🔍 Search by productName
//     if (search) {
//       filter.productName = { $regex: search, $options: "i" }; // case-insensitive
//     }

//     // 🎯 Filter by Category Name
//     if (categoryName) {
//       const categoryDoc = await Category.findOne({
//         category: { $regex: categoryName, $options: "i" }, // case-insensitive match
//       }).select("_id");

//       if (categoryDoc) {
//         filter.category = categoryDoc._id;
//       } else {
//         // If no category matches, return empty result early
//         return success(
//           res,
//           { data: [], totalRecords: 0, currentPage: pageNum, pageSize: limit },
//           "No products found for the given category."
//         );
//       }
//     }

//     /* -------------------------------------------------------------- */
//     /* Query DB                                                       */
//     /* -------------------------------------------------------------- */
//     const totalRecords = await Product.countDocuments(filter);

//     const rawProducts = await Product.find(filter)
//       .sort(sort)
//       .skip(skip)
//       .limit(limit)
//       .populate({
//         path: "category",
//         select: "category subCategory color commission",
//       });

//     const products = await Promise.all(
//       rawProducts.map(async (product) => {
//         const plainProduct = product.toObject();

//         if (plainProduct.images?.length > 0) {
//           plainProduct.images = await getPresignedImageUrls(
//             plainProduct.images
//           );
//         }

//         const updatedVariants = await Promise.all(
//           plainProduct.variants.map(async (variant) => {
//             if (variant.images?.length > 0) {
//               const imageUrls = await getPresignedImageUrls(variant.images);
//               return { ...variant, images: imageUrls };
//             }
//             return variant;
//           })
//         );

//         return { ...plainProduct, variants: updatedVariants };
//       })
//     );

//     return success(
//       res,
//       {
//         data: products,
//         totalRecords,
//         currentPage: pageNum,
//         pageSize: limit,
//       },
//       "Products retrieved successfully."
//     );
//   } catch (err) {
//     console.error("Error retrieving products:", err);
//     return serverError(res, err, "Failed to retrieve products.");
//   }
// };

export const getProducts = async (req, res) => {
  try {
    const src = req.method === "POST" ? req.body : req.query;

    const {
      page = 1,
      pageSize = 10,
      sortKey = "createdAt",
      sortDirection = "desc",
      search,
      categoryName, 
    } = src;

    const pageNum = parseInt(page, 10);
    const limit = parseInt(pageSize, 10);
    const skip = (pageNum - 1) * limit;

    const sort = {
      [sortKey]: sortDirection.toLowerCase() === "asc" ? 1 : -1,
    };

    const filter = { deleted: false };
    if (req.user.role === ROLES.VENDOR) {
      filter.vendorId = req.user.id;
    } else if (req.user.role === ROLES.ADMIN && src.vendorId) {
      filter.vendorId = src.vendorId;
    }
    if (search) {
      filter.productName = { $regex: search, $options: "i" };
    }
    if (categoryName) {
      filter.category = categoryName; 
    }
    const totalRecords = await Product.countDocuments(filter);

    const rawProducts = await Product.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate({
        path: "category",
        select: "category subCategory color commission",
      });

    const products = await Promise.all(
      rawProducts.map(async (product) => {
        const plainProduct = product.toObject();

        if (plainProduct.images?.length) {
          plainProduct.images = await getPresignedImageUrls(
            plainProduct.images
          );
        }

        const updatedVariants = await Promise.all(
          plainProduct.variants.map(async (variant) => {
            if (variant.images?.length) {
              const imageUrls = await getPresignedImageUrls(variant.images);
              return { ...variant, images: imageUrls };
            }
            return variant;
          })
        );

        return { ...plainProduct, variants: updatedVariants };
      })
    );

    return success(
      res,
      {
        data: products,
        totalRecords,
        currentPage: pageNum,
        pageSize: limit,
      },
      "Products retrieved successfully."
    );
  } catch (err) {
    console.error("Error retrieving products:", err);
    return serverError(res, err, "Failed to retrieve products.");
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;

    // ✅ Vendor check
    const vendor = await VendorDetail.findOne({ userId });
    if (!vendor) return badRequest(res, null, "Vendor profile not found.");

    // ✅ Product check
    const existingProduct = await Product.findOne({
      _id: productId,
      vendorId: vendor.userId,
    });
    if (!existingProduct)
      return notFound(res, null, "Product not found or unauthorized.");

    // ✅ Parse body
    const {
      productName,
      description,
      category,
      subCategory,
      price,
      discount = 0,
      quantity,
      unit,
      stockQuantity,
      productType,
      isAvailable,
      isCODAvailable,
      tags,
      sizes,
      highlights,
      overview,
      specifications,
      colors,
      dimensions, // ✅ new
    } = req.body;

    const parsedTags = Array.isArray(tags) ? tags : JSON.parse(tags || "[]");
    const parsedSizes = Array.isArray(sizes)
      ? sizes
      : JSON.parse(sizes || "[]");
    const parsedColors = Array.isArray(colors)
      ? colors
      : JSON.parse(colors || "[]");
    const parsedDimensions =
      typeof dimensions === "string" ? JSON.parse(dimensions) : dimensions;

    const numericPrice = parseFloat(price);
    const numericDiscount = parseFloat(discount);
    const discountedprice = Math.max(
      0,
      numericPrice - (numericPrice * numericDiscount) / 100
    ).toFixed(2);

    const productImages = [];
    const retainedFlatKeys = [];

    // ✅ Handle flat images
    for (let i = 0; i < 10; i++) {
      const fieldName = `image_${i}`;
      const retainedImg = req.body[fieldName];

      if (retainedImg && typeof retainedImg === "string") {
        const s3Key = retainedImg.includes("amazonaws.com")
          ? await extractS3Key(retainedImg)
          : retainedImg;

        if (s3Key) {
          productImages.push(s3Key);
          retainedFlatKeys.push(s3Key);
        }
        continue;
      }

      const file = req.compressedFiles?.[fieldName]?.[0];
      if (file) {
        const s3Key = `${S3TYPE.PRODUCT}/${userId}/${Date.now()}_main_${i}.jpg`;
        await uploadImage({ buffer: file.buffer, s3Name: s3Key });
        productImages.push(s3Key);
      }
    }

    // 🧹 Cleanup removed flat images
    for (const oldKey of existingProduct.images || []) {
      if (!productImages.includes(oldKey)) {
        await deleteObject(oldKey);
      }
    }

    // ✅ Handle color variants
    const deletedS3Keys = [];
    const variants = [];

    for (let i = 0; i < parsedColors.length; i++) {
      const colorObj = parsedColors[i];
      const finalImages = [];
      const retainedS3Keys = [];

      const existingVariant = existingProduct.variants?.find(
        (v) => v.colorCode === colorObj.colorCode
      );
      const originalImages = existingVariant?.images || [];

      for (let j = 0; j < 5; j++) {
        const fieldName = `color_${i}_image_${j}`;
        const retainedImg = req.body[fieldName];

        if (retainedImg && typeof retainedImg === "string") {
          const s3Key = retainedImg.includes("amazonaws.com")
            ? await extractS3Key(retainedImg)
            : retainedImg;
          if (s3Key) {
            finalImages.push(s3Key);
            retainedS3Keys.push(s3Key);
          }
          continue;
        }

        const file = req.compressedFiles?.[fieldName]?.[0];
        if (file) {
          const s3Key = `${
            S3TYPE.PRODUCT
          }/${userId}/${Date.now()}_${i}_${j}.jpg`;
          await uploadImage({ buffer: file.buffer, s3Name: s3Key });
          finalImages.push(s3Key);
          retainedS3Keys.push(s3Key);
        }
      }

      for (const originalImg of originalImages) {
        if (!retainedS3Keys.includes(originalImg)) {
          deletedS3Keys.push(originalImg);
        }
      }

      variants.push({
        colorName: colorObj.colorName,
        colorCode: colorObj.colorCode,
        images: finalImages,
      });
    }

    for (const key of deletedS3Keys) {
      await deleteObject(key);
    }

    // ✅ Final update object
    const updatedData = {
      productName,
      description,
      category,
      subCategory,
      price: numericPrice,
      discount: numericDiscount,
      discountedprice,
      quantity,
      unit,
      stockQuantity,
      productType,
      isAvailable,
      isCODAvailable,
      tags: parsedTags,
      sizes: parsedSizes,
      highlight: highlights,
      overview,
      specifications,
      variants,
      dimensions: parsedDimensions, // ✅ added
    };

    updatedData.images = productImages.length > 0 ? productImages : [];

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      updatedData,
      { new: true }
    );

    return success(res, updatedProduct, "Product updated successfully.");
  } catch (error) {
    console.error("Product update error:", error);
    return serverError(res, error, "Failed to update product.");
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;

    // Check if the vendor exists
    const vendor = await VendorDetail.findOne({ userId });
    if (!vendor) {
      return badRequest(res, null, "Vendor profile not found.");
    }

    // Find the product and ensure it belongs to the vendor
    const product = await Product.findOne({
      _id: productId,
      vendorId: vendor.userId,
    });

    if (!product) {
      return notFound(res, null, "Product not found or unauthorized.");
    }

    // Delete the product
    await Product.findByIdAndUpdate(productId, { deleted: true });

    return success(res, null, "Product deleted successfully.");
  } catch (error) {
    console.error("Product deletion error:", error);
    return serverError(res, error, "Failed to delete product.");
  }
};

//getProductsById..
export const getProductsById = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return badRequest(res, null, "Invalid product ID.");
    }

    const product = await Product.findById(productId).populate({
      path: "vendorId",
      select: "_id",
    });

    if (!product) {
      return notFound(res, null, "Product not found.");
    }

    let isInWishlist = false;
    let isAddedToCart = false;

    const userId = req.user?.id;
    if (userId) {
      const customer = await CustomerDetail.findOne({ userId: userId });
      if (customer) {
        // Check Wishlist
        const favorite = await Favorite.findOne({
          customerId: customer._id,
          productId: product._id,
        });
        isInWishlist = !!favorite;

        // 🛒 Check Cart (nested array)
        const cartItem = await Cart.findOne({
          userId: userId,
          "items.productId": product._id,
        });
        isAddedToCart = !!cartItem;
      } else {
        console.log("No CustomerDetail found for userId:", userId);
      }
    }

    const plainProduct = product.toObject();

    const vendorDetail = await VendorDetail.findOne({
      userId: plainProduct.vendorId._id,
    }).select("businessName");

    plainProduct.vendorId.businessName = vendorDetail?.businessName || "";

    const vendorTotalProducts = await Product.countDocuments({
      vendorId: plainProduct.vendorId._id,
      deleted: false,
    });

    const reviewsCount = await Review.countDocuments({
      productId: plainProduct._id,
    });

    if (plainProduct.images && plainProduct.images.length > 0) {
      plainProduct.images = await getPresignedImageUrls(plainProduct.images);
    }

    if (plainProduct.variants && plainProduct.variants.length > 0) {
      plainProduct.variants = await Promise.all(
        plainProduct.variants.map(async (variant) => {
          if (variant.images && variant.images.length > 0) {
            variant.images = await getPresignedImageUrls(variant.images);
          }
          return variant;
        })
      );
    }

    plainProduct.ratings.reviewsCount = reviewsCount;

    const productWithExtras = {
      ...plainProduct,
      isInWishlist,
      isAddedToCart, // 👈 Added here
      vendorTotalProducts,
    };

    return success(res, productWithExtras, "Product retrieved successfully.");
  } catch (error) {
    console.error("Error retrieving product:", error);
    return serverError(res, error, "Failed to retrieve product.");
  }
};

// Update product status based on dynamic field
export const updateProductStatus = async (req, res) => {
  try {
    const { productId } = req.params;
    const { statesName, status } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return badRequest(res, null, "Invalid product ID.");
    }

    const product = await Product.findById(productId);
    if (!product) {
      return notFound(res, null, "Product not found.");
    }

    // Dynamically update the field on the product
    product[statesName] = status;
    await product.save();

    return success(res, product, "Product status updated successfully.");
  } catch (error) {
    console.error("Error updating product status:", error);
    return serverError(res, error, "Failed to update product status.");
  }
};

// get-all products of 15-minutes...
export const getAllProductsOfMinutes = async (req, res) => {
  try {
    const { search } = req.query;

    // Step 1: Build filter
    const filter = {
      deleted: false,
      isAvailable: true,
      productType: 1, // Minutes products
    };

    // Apply search filter (case-insensitive)
    if (search) {
      filter.productName = { $regex: search, $options: "i" };
    }

    // Step 2: Fetch products
    let products = await Product.find(filter)
      .select(
        "productName description subCategory price discountedprice images variants productType"
      )
      .lean();

    const userId = req.user?.id;
    let customer = null;

    if (userId) {
      customer = await CustomerDetail.findOne({ userId: userId });
    }

    // Step 3: Convert image keys into pre-signed URLs + wishlist & cart check
    products = await Promise.all(
      products.map(async (product) => {
        let updatedImages = [];
        if (product.images && product.images.length > 0) {
          updatedImages = await getPresignedImageUrls(product.images);
        }

        const updatedVariants = await Promise.all(
          (product.variants || []).map(async (variant) => {
            if (variant.images && variant.images.length > 0) {
              const urls = await getPresignedImageUrls(variant.images);
              return { ...variant, images: urls };
            }
            return variant;
          })
        );

        let isInWishlist = false;
        let isAddedToCart = false;

        if (customer) {
          // Check Wishlist
          const favorite = await Favorite.findOne({
            customerId: customer._id,
            productId: product._id,
          });
          isInWishlist = !!favorite;

          // Check Cart
          const cartItem = await Cart.findOne({
            userId: userId,
            "items.productId": product._id,
          });
          isAddedToCart = !!cartItem;
        }

        return {
          ...product,
          images: updatedImages,
          variants: updatedVariants,
          isInWishlist,
          isAddedToCart,
        };
      })
    );

    return success(res, products, "Products fetched successfully.");
  } catch (error) {
    console.error("Error fetching products:", error);
    return serverError(res, error.message);
  }
};




// 15 minutes reccomended
export const getRecommendedProductsForMinutes = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const userId = req.user?.id;

    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return res.status(400).json({ message: "Valid latitude and longitude are required" });
    }

    // Step 1: Get approved vendors
    const vendors = await VendorDetail.find(
      { profileComplete: true, status: "Approved" },
      { _id: 1, businessName: 1, location: 1, userId: 1 }
    );

    if (!vendors.length) {
      return res.json({ products: [], message: "No approved vendors found." });
    }

    // Step 2: Build destinations for Google Distance Matrix
    const destinations = vendors
      .filter((v) => Array.isArray(v.location?.coordinates) && v.location.coordinates.length === 2)
      .map((v) => `${v.location.coordinates[1]},${v.location.coordinates[0]}`)
      .join("|");

    if (!destinations) {
      return res.status(400).json({ message: "Vendor locations invalid or missing." });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${latitude},${longitude}&destinations=${destinations}&mode=driving&departure_time=now&traffic_model=best_guess&key=${apiKey}`;

    const response = await axios.get(url);
    const data = response.data;

    if (!data?.rows?.[0]?.elements?.length) {
      return res.status(500).json({ message: "Failed to fetch distance data from Google API." });
    }

    const results = data.rows[0].elements;

    // Step 3: Filter vendors within 15 minutes
    const filteredVendors = vendors.reduce((acc, vendor, index) => {
      const travel = results[index];
      if (travel?.status !== "OK") return acc;

      const travelSeconds = travel.duration_in_traffic?.value || travel.duration?.value;
      if (travelSeconds && travelSeconds / 60 <= 15) {
        acc.push(vendor.userId);
      }
      return acc;
    }, []);

    if (!filteredVendors.length) {
      return res.json({
        products: [],
        message: "No vendors found within 15-minute delivery radius.",
      });
    }

    // Step 4: Fetch products only from those vendors
    let products = await Product.find({
      vendorId: { $in: filteredVendors },
      deleted: false,
      isAvailable: true,
      productType: 1,
      "ratings.overall": { $gt: 0 },
    })
      .select(
        "productName description subCategory price discountedprice images variants ratings productType vendorId"
      )
      .lean();

    // Step 5: Add discount percentage
    products = products.map((p) => {
      let discountPercent = 0;
      if (p.price && p.discountedprice) {
        discountPercent = ((p.price - p.discountedprice) / p.price) * 100;
      }
      return { ...p, discountPercent };
    });

    // Step 6: Sort (rating desc, discount desc)
    products.sort((a, b) => {
      if (b.ratings.overall !== a.ratings.overall) {
        return b.ratings.overall - a.ratings.overall;
      }
      return b.discountPercent - a.discountPercent;
    });

    // Step 7: Limit top 10
    products = products.slice(0, 10);

    // Step 8: Wishlist + Cart check
    let customer = null;
    if (userId) {
      customer = await CustomerDetail.findOne({ userId: userId });
    }

    products = await Promise.all(
      products.map(async (product) => {
        let updatedImages = [];
        if (product.images && product.images.length > 0) {
          updatedImages = await getPresignedImageUrls(product.images);
        }

        const updatedVariants = await Promise.all(
          (product.variants || []).map(async (variant) => {
            if (variant.images && variant.images.length > 0) {
              const urls = await getPresignedImageUrls(variant.images);
              return { ...variant, images: urls };
            }
            return variant;
          })
        );

        let isInWishlist = false;
        let isAddedToCart = false;

        if (customer) {
          const favorite = await Favorite.findOne({
            customerId: customer._id,
            productId: product._id,
          });
          isInWishlist = !!favorite;

          const cartItem = await Cart.findOne({
            userId: userId,
            "items.productId": product._id,
          });
          isAddedToCart = !!cartItem;
        }

        return {
          ...product,
          images: updatedImages,
          variants: updatedVariants,
          discountPercent: product.discountPercent.toFixed(2),
          isInWishlist,
          isAddedToCart,
        };
      })
    );

    return success(res, products, "Recommended products within 15-minutes fetched successfully.");
  } catch (error) {
    console.error("Error fetching recommended products:", error);
    return serverError(res, error.message);
  }
};


// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> MARKETPLACE >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> //

export const getAllProductsOfMarketPlace = async (req, res) => {
  try {
    const { search } = req.query;

    // Step 1: Build filter
    const filter = {
      deleted: false,
      isAvailable: true,
      productType: 2,
    };

    // Apply search filter (case-insensitive)
    if (search) {
      filter.productName = { $regex: search, $options: "i" };
    }

    // Step 2: Fetch products
    let products = await Product.find(filter)
      .select(
        "productName description subCategory price discountedprice images variants productType"
      )
      .lean();

    const userId = req.user?.id;
    let customer = null;

    if (userId) {
      customer = await CustomerDetail.findOne({ userId: userId });
    }

    // Step 3: Convert image keys into pre-signed URLs + wishlist & cart check
    products = await Promise.all(
      products.map(async (product) => {
        let updatedImages = [];
        if (product.images && product.images.length > 0) {
          updatedImages = await getPresignedImageUrls(product.images);
        }

        const updatedVariants = await Promise.all(
          (product.variants || []).map(async (variant) => {
            if (variant.images && variant.images.length > 0) {
              const urls = await getPresignedImageUrls(variant.images);
              return { ...variant, images: urls };
            }
            return variant;
          })
        );

        let isInWishlist = false;
        let isAddedToCart = false;

        if (customer) {
          // Check Wishlist
          const favorite = await Favorite.findOne({
            customerId: customer._id,
            productId: product._id,
          });
          isInWishlist = !!favorite;

          // Check Cart
          const cartItem = await Cart.findOne({
            userId: userId,
            "items.productId": product._id,
          });
          isAddedToCart = !!cartItem;
        }

        return {
          ...product,
          images: updatedImages,
          variants: updatedVariants,
          isInWishlist,
          isAddedToCart,
        };
      })
    );

    return success(res, products, "Products fetched successfully.");
  } catch (error) {
    console.error("Error fetching products:", error);
    return serverError(res, error.message);
  }
};



//getTopCategoriesForType2
export const getTopCategoriesByProductType = async (req, res) => {
  try {
    // Step 1: Get productType from request (query param)
    const { productType } = req.query;

    if (!productType) {
      return badRequest(res, null, "productType is required.");
    }

    // Step 2: Get distinct categoryIds for the given productType
    const categoryIds = await Product.distinct("category", {
      productType: productType, // dynamic now
      deleted: false,
      isAvailable: true,
    });

    if (!categoryIds.length) {
      return notFound(
        res,
        null,
        `No categories found for productType ${productType}.`
      );
    }

    // Step 3: Fetch categories
    const categories = await Category.find({
      _id: { $in: categoryIds },
    }).lean();

    // Step 4: Attach products (with images/variants fixed)
    const categoriesWithProducts = await Promise.all(
      categories.map(async (category) => {
        let products = await Product.find({
          category: category._id,
          productType: productType, // dynamic now
          deleted: false,
          isAvailable: true,
        })
          .select(
            "productName description subCategory price discountedprice images variants productType"
          )
          .lean();

        // Replace image keys with presigned URLs
        products = await Promise.all(
          products.map(async (product) => {
            let updatedImages = [];
            if (product.images && product.images.length > 0) {
              updatedImages = await getPresignedImageUrls(product.images);
            }

            const updatedVariants = await Promise.all(
              (product.variants || []).map(async (variant) => {
                if (variant.images && variant.images.length > 0) {
                  const urls = await getPresignedImageUrls(variant.images);
                  return { ...variant, images: urls };
                }
                return variant;
              })
            );

            return {
              ...product,
              images: updatedImages,
              variants: updatedVariants,
            };
          })
        );

        return {
          ...category,
          totalProducts: products.length,
          products,
        };
      })
    );

    return success(
      res,
      categoriesWithProducts,
      `Top categories with products for productType ${productType} fetched successfully.`
    );
  } catch (error) {
    console.error("Error fetching categories by productType:", error);
    return serverError(res, error.message);
  }
};

// Recommend Products.
export const getRecommendedProductsForMarketPlace = async (req, res) => {
  try {
    // Step 1: Build filter
    const filter = {
      deleted: false,
      isAvailable: true,
      productType: 2, // Marketplace
      "ratings.overall": { $gt: 0 }, // only products with ratings
    };

    // Step 2: Fetch products
    let products = await Product.find(filter)
      .select(
        "productName description subCategory price discountedprice images variants ratings productType"
      )
      .lean();

    // Step 3: Add discount percentage for sorting
    products = products.map((p) => {
      let discountPercent = 0;
      if (p.price && p.discountedprice) {
        discountPercent = ((p.price - p.discountedprice) / p.price) * 100;
      }
      return { ...p, discountPercent };
    });

    // Step 4: Sort (rating desc, discount% desc)
    products.sort((a, b) => {
      if (b.ratings.overall !== a.ratings.overall) {
        return b.ratings.overall - a.ratings.overall; // higher rating first
      }
      return b.discountPercent - a.discountPercent; // higher discount next
    });

    // Step 5: Limit results (e.g. top 10)
    products = products.slice(0, 10);

    const userId = req.user?.id;
    let customer = null;

    if (userId) {
      customer = await CustomerDetail.findOne({ userId: userId });
    }

    // Step 6: Convert image keys into pre-signed URLs + wishlist/cart check
    products = await Promise.all(
      products.map(async (product) => {
        let updatedImages = [];
        if (product.images && product.images.length > 0) {
          updatedImages = await getPresignedImageUrls(product.images);
        }

        const updatedVariants = await Promise.all(
          (product.variants || []).map(async (variant) => {
            if (variant.images && variant.images.length > 0) {
              const urls = await getPresignedImageUrls(variant.images);
              return { ...variant, images: urls };
            }
            return variant;
          })
        );

        let isInWishlist = false;
        let isAddedToCart = false;

        if (customer) {
          const favorite = await Favorite.findOne({
            customerId: customer._id,
            productId: product._id,
          });
          isInWishlist = !!favorite;

          const cartItem = await Cart.findOne({
            userId: userId,
            "items.productId": product._id,
          });
          isAddedToCart = !!cartItem;
        }

        return {
          ...product,
          images: updatedImages,
          variants: updatedVariants,
          discountPercent: product.discountPercent.toFixed(2),
          isInWishlist,
          isAddedToCart,
        };
      })
    );

    return success(
      res,
      products,
      "Recommended products for marketplace fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching recommended products:", error);
    return serverError(res, error.message);
  }
};


export const getTopDeals = async (req, res) => {
  try {
    // Step 1: Common product filter
    const filter = {
      deleted: false,
      isAvailable: true,
      productType: 2,
      "ratings.overall": { $gte: 4, $lte: 5 }, // only products rated 4-5
    };

    // Step 2: Get all categories
    const categories = await Category.find().select("_id category").lean();
    if (!categories || categories.length === 0) {
      return success(res, [], "No categories found.");
    }

    let bestCategory = null;
    let bestCategoryTopProduct = null;
    let bestCategoryDiscountPercent = 0;

    // Step 3: Find top product in each category
    for (const cat of categories) {
      const topProduct = await Product.findOne({
        ...filter,
        category: cat._id,
      })
        .sort({
          "ratings.overall": -1, // highest rating first
          discountedprice: 1, // lower discounted price if tie
        })
        .select(
          "productName description subCategory price discountedprice discount images variants ratings productType category"
        )
        .lean();

      if (topProduct) {
        // ✅ Prefer discount field if available
        const discountPercent =
          topProduct.discount !== undefined && topProduct.discount !== null
            ? topProduct.discount
            : (topProduct.price > 0
                ? ((topProduct.price - topProduct.discountedprice) / topProduct.price) * 100
                : 0);

        if (
          !bestCategoryTopProduct ||
          discountPercent > bestCategoryDiscountPercent ||
          (
            discountPercent === bestCategoryDiscountPercent &&
            topProduct.ratings?.overall > bestCategoryTopProduct.ratings?.overall
          )
        ) {
          bestCategory = cat;
          bestCategoryTopProduct = topProduct;
          bestCategoryDiscountPercent = discountPercent;
        }
      }
    }

    if (!bestCategory) {
      return success(res, [], "No eligible products found in any category.");
    }

    // Step 4: Get all products from the winning category
    let products = await Product.find({
      ...filter,
      category: bestCategory._id,
    })
      .sort({
        "ratings.overall": -1,
        discountedprice: 1,
      })
      .select(
        "productName description subCategory price discountedprice discount images variants ratings productType category"
      )
      .lean();

    const userId = req.user?.id;
    let customer = null;

    if (userId) {
      customer = await CustomerDetail.findOne({ userId: userId });
    }

    // Step 5: Replace image keys with presigned URLs + wishlist & cart flags
    products = await Promise.all(
      products.map(async (product) => {
        let updatedImages = [];
        if (product.images && product.images.length > 0) {
          updatedImages = await getPresignedImageUrls(product.images);
        }

        const updatedVariants = await Promise.all(
          (product.variants || []).map(async (variant) => {
            if (variant.images && variant.images.length > 0) {
              const urls = await getPresignedImageUrls(variant.images);
              return { ...variant, images: urls };
            }
            return variant;
          })
        );

        // ✅ Prefer discount field if available
        const discountPercent =
          product.discount !== undefined && product.discount !== null
            ? product.discount
            : (product.price > 0
                ? ((product.price - product.discountedprice) / product.price) * 100
                : 0);

        let isInWishlist = false;
        let isAddedToCart = false;

        if (customer) {
          const favorite = await Favorite.findOne({
            customerId: customer._id,
            productId: product._id,
          });
          isInWishlist = !!favorite;

          const cartItem = await Cart.findOne({
            userId: userId,
            "items.productId": product._id,
          });
          isAddedToCart = !!cartItem;
        }

        return {
          ...product,
          images: updatedImages,
          variants: updatedVariants,
          discountPercent: discountPercent.toFixed(2),
          isInWishlist,
          isAddedToCart,
        };
      })
    );

    return success(
      res,
      { category: bestCategory.category, products },
      `Best deals fetched from category: ${bestCategory.category}`
    );
  } catch (error) {
    console.error("Error fetching best category deals:", error);
    return serverError(res, error.message);
  }
};
