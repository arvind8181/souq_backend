import JsonRes from "../../helpers/response.js";
import mongoose from "mongoose";
import User from "../../models/user/user.js";
import VendorDetail from "../../models/vendorDetails/vendorDetails.js";
import Product from "../../models/product/products.js";
import Favorite from "../../models/favourite/favourite.js";
import Review from "../../models/review/review.js";
import CustomerDetail from "../../models/customerDetails/customerDetails.js";
import Cart from "../../models/cart/cart.js";
import jwt from "jsonwebtoken";
import axios from "axios";
import { sendMail } from "../../helpers/mail.js";
import { verifyOtpAndGetUser } from "../../services/otp.js";
import { generateAndSendOtp } from "../../services/generateAndSendOtp.js";
import { S3TYPE } from "../../utils/constant.js";
import {
  uploadImage,
  getPresignedImageUrls,
} from "../../services/s3Service.js";
const {
  badRequest,
  conflict,
  success,
  serverError,
  failed,
  dataCreated,
  unauthorized,
  notFound,
} = JsonRes;

export const getPendingVendors = async (req, res) => {
  try {
    const { businessName, ownerName, email, page = 1, limit = 10 } = req.query;

    // Convert page & limit to integers
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    let matchQuery = {
      status: "Pending",
      profileComplete: true,
    };

    // Match businessName and ownerName in MongoDB
    if (businessName) {
      matchQuery.businessName = { $regex: businessName, $options: "i" };
    }
    if (ownerName) {
      matchQuery.ownerName = { $regex: ownerName, $options: "i" };
    }

    // Fetch vendors with user info
    let pendingVendors = await VendorDetail.find(matchQuery)
      .populate({
        path: "userId",
        select: "email",
        model: User,
      })
      .skip(skip)
      .limit(limitNumber)
      .lean();

    // Filter by email after populate
    if (email) {
      pendingVendors = pendingVendors.filter((vendor) =>
        vendor.userId?.email?.toLowerCase().includes(email.toLowerCase())
      );
    }

    // Get total count for pagination metadata
    const totalCount = await VendorDetail.countDocuments(matchQuery);

    // Presigned URL for licenseDocument
    await Promise.all(
      pendingVendors.map(async (vendor) => {
        if (vendor.licenseDocument) {
          const [licenseUrl] = await getPresignedImageUrls([
            vendor.licenseDocument,
          ]);
          vendor.licenseDocument = licenseUrl;
        }
      })
    );

    return success(
      res,
      {
        vendors: pendingVendors,
        pagination: {
          total: totalCount,
          page: pageNumber,
          limit: limitNumber,
          totalPages: Math.ceil(totalCount / limitNumber),
        },
      },
      "Fetched all pending vendors successfully."
    );
  } catch (error) {
    console.error("Error fetching pending vendors:", error);
    return serverError(res, error, "Failed to fetch pending vendors.");
  }
};

export const updateVendorStatus = async (req, res) => {
  const { vendorId, status, deleted } = req.body;

  try {
    if (!vendorId) {
      return badRequest(res, null, "Vendor ID is required.");
    }

    // Fetch vendor and user info
    const vendor = await VendorDetail.findById(vendorId).populate({
      path: "userId",
      select: "email name deleted",
      model: User,
    });

    if (!vendor) {
      return notFound(res, null, "Vendor not found with the given ID.");
    }

    const user = vendor.userId;

    console.log(user);
    if (!user) {
      return notFound(res, null, "Vendor user not found.");
    }

    // ----- ✅ Handle status update -----
    if (status !== undefined) {
      const allowedStatuses = ["Approved", "Rejected"];
      if (!allowedStatuses.includes(status)) {
        return badRequest(
          res,
          null,
          "Invalid status value. Use 'Approved' or 'Rejected'."
        );
      }

      vendor.status = status;
      await vendor.save();

      const emailSubject =
        status === "Approved"
          ? "Vendor Account Approved"
          : "Vendor Account Rejected";

      const emailBody =
        status === "Approved"
          ? `<p>Congratulations! Your vendor account has been <strong>approved</strong>.</p>
             <p>You can now log in and start listing your products on Dual MarketPlace.</p>`
          : `<p>Unfortunately, your vendor account has been <strong>rejected</strong>.</p>
             <p>If you believe this is a mistake or want more details, feel free to contact support.</p>`;

      await sendMail({
        to: user.email,
        subject: emailSubject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <div style="background: #4CAF50; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h2 style="color: white; margin: 0;">Vendor Status Update</h2>
            </div>
            <div style="padding: 20px; background: #f9f9f9; border-radius: 0 0 8px 8px;">
              <p>Hello ${user.name || ""},</p>
              ${emailBody}
              <p style="margin-top: 30px;">Best regards,<br>Dual MarketPlace Team</p>
            </div>
          </div>
        `,
      });
    }

    // ----- ✅ Handle delete/reactivate -----
    if (typeof deleted === "boolean") {
      user.deleted = deleted;
      console.log(user);
      await user.save();

      const emailSubject = deleted
        ? "Vendor Account Deactivated"
        : "Vendor Account Reactivated";

      const emailBody = deleted
        ? `<p>Your vendor account has been <strong>deactivated</strong>.</p>
           <p>If you have questions or believe this was a mistake, please contact support.</p>`
        : `<p>Your vendor account has been <strong>re-activated</strong>.</p>
           <p>You may now access your account and continue using the platform.</p>`;

      await sendMail({
        to: user.email,
        subject: emailSubject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <div style="background: #FF9800; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h2 style="color: white; margin: 0;">Vendor Account ${
                deleted ? "Deactivated" : "Reactivated"
              }</h2>
            </div>
            <div style="padding: 20px; background: #f9f9f9; border-radius: 0 0 8px 8px;">
              <p>Hello ${user.name || ""},</p>
              ${emailBody}
              <p style="margin-top: 30px;">Best regards,<br>Dual MarketPlace Team</p>
            </div>
          </div>
        `,
      });

      return success(
        res,
        { userId: user._id, deleted: user.deleted },
        `Vendor account has been ${
          deleted ? "deactivated" : "reactivated"
        } successfully.`
      );
    }

    return success(
      res,
      vendor,
      status
        ? `Vendor status updated to '${status}' successfully.`
        : "No changes made."
    );
  } catch (error) {
    console.error("Error updating vendor status or account:", error);
    return serverError(
      res,
      error,
      "Failed to update vendor status or deletion."
    );
  }
};

export const getVendor = async (req, res) => {
  try {
    const userId = req.user.id;

    const Vendor = await VendorDetail.findOne({
      userId: userId,
    }).populate({
      path: "userId",
      select: "email",
      model: User,
    });
    if (Vendor.licenseDocument) {
      const [licenseUrl] = await getPresignedImageUrls([
        Vendor.licenseDocument,
      ]);
      Vendor.licenseDocument = licenseUrl;
    }
    if (Vendor.profilePicture) {
      const [profilePictureUrl] = await getPresignedImageUrls([
        Vendor.profilePicture,
      ]);
      Vendor.profilePicture = profilePictureUrl;
    }
    return success(res, Vendor, "Fetched vendor successfully.");
  } catch (error) {
    console.error("Error fetching vendor:", error);
    return serverError(res, error, "Failed to fetch vendor.");
  }
};
export const getVendors = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      page = 1,
      pageSize = 10,
      sortKey = "createdAt",
      sortDirection = "desc",
      search = "",
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limit = parseInt(pageSize, 10);
    const skip = (pageNum - 1) * limit;

    const sortOrder = sortDirection.toLowerCase() === "asc" ? 1 : -1;
    const sortOptions = { [sortKey]: sortOrder };

    const filter = {
      profileComplete: true,
      status: "Approved",
      $or: [
        { "userId.email": { $regex: new RegExp(search, "i") } },
        { businessName: { $regex: new RegExp(search, "i") } },
        { ownerName: { $regex: new RegExp(search, "i") } },
      ],
    };

    const totalRecords = await VendorDetail.countDocuments(filter);

    const vendors = await VendorDetail.find(filter)
      .populate({
        path: "userId",
        select: "email",
        model: User,
      })
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean();

    // Collect all licenseDocument keys
    const allLicenseKeys = vendors
      .map((vendor) => vendor.licenseDocument)
      .filter(Boolean);

    const presignedUrls = await getPresignedImageUrls(allLicenseKeys);

    let urlIndex = 0;
    const updatedVendors = vendors.map((vendor) => {
      if (vendor.licenseDocument) {
        vendor.licenseDocument = presignedUrls[urlIndex++];
      }
      return vendor;
    });

    return success(
      res,
      {
        data: updatedVendors,
        totalRecords,
        currentPage: pageNum,
        pageSize: limit,
      },
      "Vendors retrieved successfully."
    );
  } catch (error) {
    console.error("Error retrieving vendors:", error);
    return serverError(res, error, "Failed to retrieve vendors.");
  }
};

export const getAllVendors = async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 10,
      sortKey = "createdAt",
      sortDirection = "desc",
      search = "",
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limit = parseInt(pageSize, 10);
    const skip = (pageNum - 1) * limit;

    const sortOrder = sortDirection.toLowerCase() === "asc" ? 1 : -1;
    const sortOptions = { [sortKey]: sortOrder };

    // 👇 Aggregation pipeline
    // 👇 Aggregation pipeline
    const pipeline = [
      { $match: { profileComplete: true } },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          "user.password": 0,
          "user.__v": 0,
        },
      },
      ...(search
        ? [
            {
              $match: {
                $or: [
                  { "user.email": { $regex: search, $options: "i" } },
                  { businessName: { $regex: search, $options: "i" } },
                  { ownerName: { $regex: search, $options: "i" } },
                ],
              },
            },
          ]
        : []),
      { $sort: sortOptions },
      { $skip: skip },
      { $limit: limit },
    ];

    // Get vendors with pagination
    const vendors = await VendorDetail.aggregate(pipeline);

    // Count pipeline
    const countPipeline = [
      { $match: { profileComplete: true } },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      ...(search
        ? [
            {
              $match: {
                $or: [
                  { "user.email": { $regex: search, $options: "i" } },
                  { businessName: { $regex: search, $options: "i" } },
                  { ownerName: { $regex: search, $options: "i" } },
                ],
              },
            },
          ]
        : []),
      { $count: "total" },
    ];

    const countResult = await VendorDetail.aggregate(countPipeline);
    const totalRecords = countResult[0]?.total || 0;

    // 🔑 Handle presigned URLs
    const licenseKeys = vendors.map((v) => v.licenseDocument).filter(Boolean);
    const presignedUrls = await getPresignedImageUrls(licenseKeys);

    let urlIndex = 0;
    const updatedVendors = vendors.map((v) => {
      if (v.licenseDocument) {
        v.licenseDocument = presignedUrls[urlIndex++];
      }
      return v;
    });

    return success(
      res,
      {
        data: updatedVendors,
        totalRecords,
        currentPage: pageNum,
        pageSize: limit,
      },
      "Vendors retrieved successfully."
    );
  } catch (error) {
    console.error("Error retrieving vendors:", error);
    return serverError(res, error, "Failed to retrieve vendors.");
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return unauthorized(res, null, "Authorization token is missing.");
    }
    const token = authHeader.split(" ")[1];
    const { otp } = req.body;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    // Verify OTP
    await verifyOtpAndGetUser(otp, token);

    // Update user verification status
    await User.findByIdAndUpdate(userId, {
      $set: { verified: true },
      $unset: { otp: "" },
    });
    return success(res, null, "OTP verified.");
  } catch (error) {
    console.error("OTP verification error:", error);
    return serverError(res, error, "OTP verification failed.");
  }
};

export const resendOtp = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return unauthorized(res, null, "Authorization token is missing.");
    }
    const token = authHeader.split(" ")[1];
    if (!token) {
      return badRequest(res, null, "Token is required.");
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return badRequest(res, null, "Invalid or expired token.");
    }

    const user = await User.findOne({
      email: decoded.email,
      role: decoded.role,
    });
    if (!user) {
      return badRequest(res, null, "User not found.");
    }

    const {
      otpCode,
      otpExpiresAt,
      token: newToken,
    } = await generateAndSendOtp(user);

    user.otp = {
      code: otpCode,
      expiresAt: otpExpiresAt,
    };
    await user.save();

    return success(res, { token: newToken }, "New OTP sent to email.");
  } catch (err) {
    console.error("Resend OTP error:", err);
    return serverError(res, err, "Failed to resend OTP.");
  }
};

export const updateVendorProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const vendor = await VendorDetail.findOne({ userId });
    if (!vendor) return notFound(res, null, "Vendor profile not found.");
    if (typeof req.body.category === "string") {
      req.body.category = JSON.parse(req.body.category);
    }

    const fields = [
      "businessName",
      "ownerName",
      "commercialRegNo",
      "vatOrTaxId",
      "nationalIdNumber",
      "businessPhone",
      "whatsappNumber",
      "category",
      "bankOrMobilePayInfo",
    ];

    fields.forEach((f) => {
      if (req.body[f] !== undefined) vendor[f] = req.body[f];
    });
    // ✅ Parse early
    if (typeof req.body.location === "string") {
      req.body.location = JSON.parse(req.body.location);
    }
    if (typeof req.body.address === "string") {
      req.body.address = JSON.parse(req.body.address);
    }
    if (typeof req.body.category === "string") {
      req.body.category = JSON.parse(req.body.category);
    }

    // Location
    if (
      req.body.location?.coordinates?.length === 2 &&
      Array.isArray(req.body.location.coordinates)
    ) {
      vendor.location = {
        type: "Point",
        coordinates: req.body.location.coordinates.map(Number),
      };
    }

    // Address
    if (req.body.address) {
      const { street, city, state, country } = req.body.address;
      vendor.address = {
        street: street ?? vendor.address.street,
        city: city ?? vendor.address.city,
        state: state ?? vendor.address.state,
        country: country ?? vendor.address.country,
      };
    }

    // Upload licenseDocument (PDF or image)
    if (req.compressedFiles?.License?.[0]) {
      const file = req.compressedFiles.License[0];
      const ext = file.mimetype === "application/pdf" ? "pdf" : "jpg";
      const s3Key = `${S3TYPE.VENDOR}/${userId}/license.${ext}`;

      await uploadImage({
        buffer: file.buffer,
        s3Name: s3Key,
      });

      vendor.licenseDocument = s3Key;
    }

    if (req.compressedFiles?.profilePicture?.[0]) {
      const file = req.compressedFiles.profilePicture[0];
      const ext = file.mimetype === "application/pdf" ? "pdf" : "jpg";
      const s3Key = `${S3TYPE.VENDOR}/${userId}/profilePicture.${ext}`;

      await uploadImage({
        buffer: file.buffer,
        s3Name: s3Key,
      });

      vendor.profilePicture = s3Key;
    }

    vendor.profileComplete = true;
    console.log("vendor", vendor);
    await vendor.save();

    return success(res, vendor, "Vendor profile updated.");
  } catch (err) {
    console.error("updateVendorProfile error:", err);
    return serverError(res, err, "Failed to update vendor profile.");
  }
};

// get nearby vendors by using google api...
export const getNearbyVendors = async (req, res) => {
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
      return res
        .status(400)
        .json({ message: "Valid latitude and longitude are required" });
    }

    const vendors = await VendorDetail.find(
      { profileComplete: true, status: "Approved" },
      { _id: 1, businessName: 1, location: 1, userId: 1 }
    );

    if (!vendors.length) {
      return res.json({ vendors: [], message: "No approved vendors found." });
    }

    const destinations = vendors
      .filter(
        (v) =>
          Array.isArray(v.location?.coordinates) &&
          v.location.coordinates.length === 2
      )
      .map((v) => `${v.location.coordinates[1]},${v.location.coordinates[0]}`)
      .join("|");

    if (!destinations) {
      return res
        .status(400)
        .json({ message: "Vendor locations invalid or missing." });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${latitude},${longitude}&destinations=${destinations}&mode=driving&departure_time=now&traffic_model=best_guess&key=${apiKey}`;

    const response = await axios.get(url);
    const data = response.data;

    if (!data?.rows?.[0]?.elements?.length) {
      return res
        .status(500)
        .json({ message: "Failed to fetch distance data from Google API." });
    }

    const results = data.rows[0].elements;

    // Filter vendors with valid travel time <= 20 minutes
    const filteredVendors = vendors.reduce((acc, vendor, index) => {
      const travel = results[index];

      if (travel?.status !== "OK") {
        console.log(
          `Skipping vendor ${vendor.businessName} - Google API status: ${travel?.status}`
        );
        return acc;
      }

      const travelSeconds =
        travel.duration_in_traffic?.value || travel.duration?.value;
      if (travelSeconds && travelSeconds / 60 <= 20) {
        acc.push({
          vendor,
          travelSeconds,
          distanceMeters: travel.distance?.value || 0,
        });
      } else {
        console.log(`Vendor ${vendor.businessName} is beyond 20 minutes`);
      }

      return acc;
    }, []);

    if (!filteredVendors.length) {
      return res.json({
        vendors: [],
        message: "No vendors found within 20-minute delivery radius.",
      });
    }

    const vendorUserIds = filteredVendors.map((v) => v.vendor.userId);

    const rawProducts = await Product.find({
      vendorId: { $in: vendorUserIds },
      isAvailable: true,
      deleted: false,
      productType: "1",
    }).populate({
      path: "category",
      select: "_id category",
    });

    let favoriteProductIds = [];
    if (userId) {
      const customer = await CustomerDetail.findOne({ userId });
      if (customer) {
        const favorites = await Favorite.find({
          customerId: customer._id,
        }).lean();
        favoriteProductIds = favorites
          .filter((f) => f.productId)
          .map((f) => f.productId.toString());
      }
    }

    const products = await Promise.all(
      rawProducts.map(async (product) => {
        const plainProduct = product.toObject();
        if (plainProduct.images?.length > 0) {
          plainProduct.images = await getPresignedImageUrls(
            plainProduct.images
          );
        }
        if (plainProduct.variants?.length > 0) {
          plainProduct.variants = await Promise.all(
            plainProduct.variants.map(async (variant) => {
              if (variant.images?.length > 0) {
                variant.images = await getPresignedImageUrls(variant.images);
              }
              return variant;
            })
          );
        }
        return plainProduct;
      })
    );

    const responseData = filteredVendors
      .map(({ vendor, travelSeconds, distanceMeters }) => {
        const vendorProducts = products.filter(
          (p) => p.vendorId.toString() === vendor.userId.toString()
        );

        if (!vendorProducts.length) {
          console.log(`Vendor ${vendor.businessName} skipped - no products`);
          return null;
        }

        const groupedByCategory = vendorProducts.reduce((acc, product) => {
          let categoryName;
          if (product.category && typeof product.category === "object") {
            categoryName = product.category.category;
          } else if (typeof product.category === "string") {
            categoryName = product.category;
          }
          if (categoryName) {
            if (!acc[categoryName]) acc[categoryName] = [];
            const isInWishlist = favoriteProductIds.includes(
              product._id.toString()
            );

            acc[categoryName].push({ ...product, isInWishlist });
          }
          return acc;
        }, {});

        const categories = Object.keys(groupedByCategory).map((cat) => ({
          category: cat,
          totalProducts: groupedByCategory[cat].length,
          products: groupedByCategory[cat],
        }));

        return {
          vendorId: vendor._id,
          businessName: vendor.businessName,
          location: vendor.location,
          travel_time_min: travelSeconds
            ? (travelSeconds / 60).toFixed(1)
            : null,
          distance_km: distanceMeters
            ? (distanceMeters / 1000).toFixed(2)
            : null,
          totalProducts: vendorProducts.length,
          categories,
        };
      })
      .filter((v) => v !== null); // Remove vendors without products

    if (!responseData.length) {
      return res.json({
        vendors: [],
        message:
          "No vendors found within 20 minutes having available products.",
      });
    }

    return res.json({ vendors: responseData });
  } catch (err) {
    console.error("Error finding nearby vendors:", err);
    return res
      .status(500)
      .json({ message: "Server error while finding nearby vendors" });
  }
};

// GET VENDOR PRODUCTS
export const getVendorProducts = async (req, res) => {
  try {
    const vendorId = req.params.vendorId;

    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(400).json({ message: "Invalid vendorId." });
    }

    const products = await Product.find({
      vendorId,
      isAvailable: true,
      deleted: false,
    }).populate({
      path: "category",
      select: "_id category",
    });

    // Transform each product: add presigned URLs for images & variant images
    const updatedProducts = await Promise.all(
      products.map(async (product) => {
        const plainProduct = product.toObject();

        // Replace main product images with presigned URLs
        if (plainProduct.images?.length > 0) {
          plainProduct.images = await getPresignedImageUrls(
            plainProduct.images
          );
        }

        // Replace variant images with presigned URLs
        if (plainProduct.variants?.length > 0) {
          plainProduct.variants = await Promise.all(
            plainProduct.variants.map(async (variant) => {
              if (variant.images?.length > 0) {
                variant.images = await getPresignedImageUrls(variant.images);
              }
              return variant;
            })
          );
        }

        return plainProduct;
      })
    );

    return res.json({
      total: updatedProducts.length,
      products: updatedProducts,
    });
  } catch (err) {
    console.error("Error finding vendor products:", err);
    return res
      .status(500)
      .json({ message: "Server error while finding vendor products" });
  }
};

export const subscribeVendor = async (req, res) => {
  try {
    const userId = req.user.id;
    const { premiumPlan } = req.body;

    if (!premiumPlan) {
      return badRequest(res, null, "Premium plan is required.");
    }

    const vendor = await VendorDetail.findOne({ userId });

    if (!vendor) {
      return notFound(res, null, "Vendor profile not found.");
    }

    if (vendor.isPremium) {
      return badRequest(res, null, "You are already subscribed.");
    }

    vendor.isPremium = true;
    vendor.premiumPlan = premiumPlan;
    vendor.hasAppliedForPremium = false; // Reset this field

    const now = new Date(); // current UTC time
    let endDate = new Date(now);

    switch (premiumPlan) {
      case "Monthly":
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case "Quarterly":
        endDate.setMonth(endDate.getMonth() + 3);
        break;
      case "Yearly":
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
      default:
        return badRequest(res, null, "Invalid premium plan.");
    }
    vendor.premiumStartDate = now;
    vendor.premiumEndDate = endDate;

    await vendor.save();

    return success(res, vendor, "Subscription successfully.");
  } catch (error) {
    console.error("Error subscribing vendor:", error);
    return serverError(res, error, "Failed to subscribe vendor.");
  }
};

export const updateVendorSubscription = async (req, res) => {
  try {
    const { vendorId, isPremium, hasAppliedForPremium } = req.body;

    if (!vendorId) {
      return badRequest(res, null, "Vendor ID is required.");
    }

    const vendor = await VendorDetail.findById(vendorId);

    if (!vendor) {
      return notFound(res, null, "Vendor not found.");
    }

    vendor.isPremium = isPremium;
    vendor.hasAppliedForPremium = hasAppliedForPremium;

    if (isPremium) {
      const plan = vendor.premiumPlan;

      if (!plan) {
        return badRequest(res, null, "Premium plan is not set.");
      }

      const now = new Date(); // current UTC time
      let endDate = new Date(now);

      switch (plan) {
        case "Monthly":
          endDate.setMonth(endDate.getMonth() + 1);
          break;
        case "Quarterly":
          endDate.setMonth(endDate.getMonth() + 3);
          break;
        case "Yearly":
          endDate.setFullYear(endDate.getFullYear() + 1);
          break;
        default:
          return badRequest(res, null, "Invalid premium plan.");
      }

      vendor.premiumStartDate = now;
      vendor.premiumEndDate = endDate;
    } else {
      vendor.premiumPlan = null;
      vendor.premiumStartDate = null;
      vendor.premiumEndDate = null;
    }

    await vendor.save();

    return success(res, vendor, "Vendor subscription updated successfully.");
  } catch (error) {
    console.error("Error updating vendor subscription:", error);
    return serverError(res, error, "Failed to update vendor subscription.");
  }
};

// Get all products 15minutes and MarketPlace
export const getAllProductsOfMinutesAndMarketPlace = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const { search } = req.query; // 🔍 search keyword
    const userId = req.user?.id;

    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return res
        .status(400)
        .json({ message: "Valid latitude and longitude are required" });
    }

    const vendors = await VendorDetail.find(
      { profileComplete: true, status: "Approved" },
      { _id: 1, businessName: 1, location: 1, userId: 1 }
    );

    if (!vendors.length) {
      return res.json({ vendors: [], message: "No approved vendors found." });
    }

    const destinations = vendors
      .filter(
        (v) =>
          Array.isArray(v.location?.coordinates) &&
          v.location.coordinates.length === 2
      )
      .map((v) => `${v.location.coordinates[1]},${v.location.coordinates[0]}`)
      .join("|");

    if (!destinations) {
      return res
        .status(400)
        .json({ message: "Vendor locations invalid or missing." });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${latitude},${longitude}&destinations=${destinations}&mode=driving&departure_time=now&traffic_model=best_guess&key=${apiKey}`;

    const response = await axios.get(url);
    const data = response.data;

    if (!data?.rows?.[0]?.elements?.length) {
      return res
        .status(500)
        .json({ message: "Failed to fetch distance data from Google API." });
    }

    const results = data.rows[0].elements;

    // Filter vendors within 20 mins
    const filteredVendors = vendors.reduce((acc, vendor, index) => {
      const travel = results[index];

      if (travel?.status !== "OK") return acc;

      const travelSeconds =
        travel.duration_in_traffic?.value || travel.duration?.value;

      if (travelSeconds && travelSeconds / 60 <= 20) {
        acc.push({
          vendor,
          travelSeconds,
          distanceMeters: travel.distance?.value || 0,
        });
      }
      return acc;
    }, []);

    if (!filteredVendors.length) {
      return res.json({
        vendors: [],
        message: "No vendors found within 20-minute delivery radius.",
      });
    }

    const vendorUserIds = filteredVendors.map((v) => v.vendor.userId);

    // ✅ Apply product search if provided
    const productFilter = {
      vendorId: { $in: vendorUserIds },
      isAvailable: true,
      deleted: false,
    };
    if (search) {
      productFilter.productName = { $regex: search, $options: "i" };
    }

    const rawProducts = await Product.find(productFilter).populate({
      path: "category",
      select: "_id category",
    });

    let favoriteProductIds = [];
    if (userId) {
      const customer = await CustomerDetail.findOne({ userId });
      if (customer) {
        const favorites = await Favorite.find({
          customerId: customer._id,
        }).lean();
        favoriteProductIds = favorites
          .filter((f) => f.productId)
          .map((f) => f.productId.toString());
      }
    }

    const products = await Promise.all(
      rawProducts.map(async (product) => {
        const plainProduct = product.toObject();
        if (plainProduct.images?.length > 0) {
          plainProduct.images = await getPresignedImageUrls(
            plainProduct.images
          );
        }
        if (plainProduct.variants?.length > 0) {
          plainProduct.variants = await Promise.all(
            plainProduct.variants.map(async (variant) => {
              if (variant.images?.length > 0) {
                variant.images = await getPresignedImageUrls(variant.images);
              }
              return variant;
            })
          );
        }
        return plainProduct;
      })
    );

    const responseData = filteredVendors
      .map(({ vendor, travelSeconds, distanceMeters }) => {
        const vendorProducts = products.filter(
          (p) => p.vendorId.toString() === vendor.userId.toString()
        );

        if (!vendorProducts.length) return null;

        const groupedByCategory = vendorProducts.reduce((acc, product) => {
          let categoryName =
            product.category && typeof product.category === "object"
              ? product.category.category
              : product.category;

          if (categoryName) {
            if (!acc[categoryName]) acc[categoryName] = [];
            const isInWishlist = favoriteProductIds.includes(
              product._id.toString()
            );
            acc[categoryName].push({ ...product, isInWishlist });
          }
          return acc;
        }, {});

        const categories = Object.keys(groupedByCategory).map((cat) => ({
          category: cat,
          totalProducts: groupedByCategory[cat].length,
          products: groupedByCategory[cat],
        }));

        return {
          vendorId: vendor._id,
          businessName: vendor.businessName,
          location: vendor.location,
          travel_time_min: travelSeconds
            ? (travelSeconds / 60).toFixed(1)
            : null,
          distance_km: distanceMeters
            ? (distanceMeters / 1000).toFixed(2)
            : null,
          totalProducts: vendorProducts.length,
          categories,
        };
      })
      .filter((v) => v !== null);

    if (!responseData.length) {
      return res.json({
        vendors: [],
        message:
          "No vendors found within 20 minutes having available products.",
      });
    }

    return res.json({ vendors: responseData });
  } catch (err) {
    console.error("Error finding nearby vendors:", err);
    return res
      .status(500)
      .json({ message: "Server error while finding nearby vendors" });
  }
};

// combined three api's (Home page api)
export const getMarketplaceCombinedForHomeApi = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const { search } = req.query;
    const userId = req.user?.id;

    // Validate coordinates for minutes and marketplace sections
    let hasValidCoordinates = false;
    if (
      typeof latitude === "number" &&
      typeof longitude === "number" &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    ) {
      hasValidCoordinates = true;
    }

    const response = {
      minutesProducts: {
        vendors: [],
        message: "",
      },
      marketplaceRecommendations: {
        products: [],
        message: "",
      },
      minutesRecommendations: {
        products: [],
        message: "",
      },
    };

    // Get customer details once for reuse
    let customer = null;
    if (userId) {
      customer = await CustomerDetail.findOne({ userId: userId });
    }

    // =====================================
    // 1. GET ALL PRODUCTS OF MINUTES AND MARKETPLACE
    // =====================================

    if (hasValidCoordinates) {
      const vendors = await VendorDetail.find(
        { profileComplete: true, status: "Approved" },
        { _id: 1, businessName: 1, location: 1, userId: 1 }
      );

      if (vendors.length > 0) {
        const destinations = vendors
          .filter(
            (v) =>
              Array.isArray(v.location?.coordinates) &&
              v.location.coordinates.length === 2
          )
          .map(
            (v) => `${v.location.coordinates[1]},${v.location.coordinates[0]}`
          )
          .join("|");

        if (destinations) {
          const apiKey = process.env.GOOGLE_MAPS_API_KEY;
          const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${latitude},${longitude}&destinations=${destinations}&mode=driving&departure_time=now&traffic_model=best_guess&key=${apiKey}`;

          const googleResponse = await axios.get(url);
          const data = googleResponse.data;

          if (data?.rows?.[0]?.elements?.length) {
            const results = data.rows[0].elements;

            // Filter vendors within 20 mins
            const filteredVendors = vendors.reduce((acc, vendor, index) => {
              const travel = results[index];

              if (travel?.status !== "OK") return acc;

              const travelSeconds =
                travel.duration_in_traffic?.value || travel.duration?.value;

              if (travelSeconds && travelSeconds / 60 <= 20) {
                acc.push({
                  vendor,
                  travelSeconds,
                  distanceMeters: travel.distance?.value || 0,
                });
              }
              return acc;
            }, []);

            if (filteredVendors.length > 0) {
              const vendorUserIds = filteredVendors.map((v) => v.vendor.userId);

              // ✅ Apply product search if provided
              const productFilter = {
                vendorId: { $in: vendorUserIds },
                isAvailable: true,
                deleted: false,
              };
              if (search) {
                productFilter.productName = { $regex: search, $options: "i" };
              }

              const rawProducts = await Product.find(productFilter).populate({
                path: "category",
                select: "_id category",
              });

              let favoriteProductIds = [];
              if (customer) {
                const favorites = await Favorite.find({
                  customerId: customer._id,
                }).lean();
                favoriteProductIds = favorites
                  .filter((f) => f.productId)
                  .map((f) => f.productId.toString());
              }

              const products = await Promise.all(
                rawProducts.map(async (product) => {
                  const plainProduct = product.toObject();
                  if (plainProduct.images?.length > 0) {
                    plainProduct.images = await getPresignedImageUrls(
                      plainProduct.images
                    );
                  }
                  if (plainProduct.variants?.length > 0) {
                    plainProduct.variants = await Promise.all(
                      plainProduct.variants.map(async (variant) => {
                        if (variant.images?.length > 0) {
                          variant.images = await getPresignedImageUrls(
                            variant.images
                          );
                        }
                        return variant;
                      })
                    );
                  }
                  return plainProduct;
                })
              );

              const responseData = filteredVendors
                .map(({ vendor, travelSeconds, distanceMeters }) => {
                  const vendorProducts = products.filter(
                    (p) => p.vendorId.toString() === vendor.userId.toString()
                  );

                  if (!vendorProducts.length) return null;

                  const groupedByCategory = vendorProducts.reduce(
                    async (accPromise, product) => {
                      const acc = await accPromise;
                      let categoryName =
                        product.category && typeof product.category === "object"
                          ? product.category.category
                          : product.category;

                      if (categoryName) {
                        if (!acc[categoryName]) acc[categoryName] = [];

                        const isInWishlist = favoriteProductIds.includes(
                          product._id.toString()
                        );

                        // Check if user has reviewed this product
                        let isReviewed = false;
                        if (customer) {
                          const review = await Review.findOne({
                            productId: product._id,
                            userId: customer._id,
                            deleted: false,
                          });
                          isReviewed = !!review;
                        }

                        acc[categoryName].push({
                          ...product,
                          isInWishlist,
                          isReviewed,
                        });
                      }
                      return acc;
                    },
                    Promise.resolve({})
                  );

                  return groupedByCategory.then((resolvedGrouped) => {
                    const categories = Object.keys(resolvedGrouped).map(
                      (cat) => ({
                        category: cat,
                        totalProducts: resolvedGrouped[cat].length,
                        products: resolvedGrouped[cat],
                      })
                    );

                    return {
                      vendorId: vendor._id,
                      businessName: vendor.businessName,
                      location: vendor.location,
                      travel_time_min: travelSeconds
                        ? (travelSeconds / 60).toFixed(1)
                        : null,
                      distance_km: distanceMeters
                        ? (distanceMeters / 1000).toFixed(2)
                        : null,
                      totalProducts: vendorProducts.length,
                      categories,
                    };
                  });
                })
                .filter((v) => v !== null);

              const resolvedResponseData = await Promise.all(responseData);

              if (resolvedResponseData.length > 0) {
                response.minutesProducts.vendors = resolvedResponseData;
              } else {
                response.minutesProducts.message =
                  "No vendors found within 20 minutes having available products.";
              }
            } else {
              response.minutesProducts.message =
                "No vendors found within 20-minute delivery radius.";
            }
          } else {
            response.minutesProducts.message =
              "Failed to fetch distance data from Google API.";
          }
        } else {
          response.minutesProducts.message =
            "Vendor locations invalid or missing.";
        }
      } else {
        response.minutesProducts.message = "No approved vendors found.";
      }
    } else {
      response.minutesProducts.message =
        "Valid latitude and longitude are required";
    }

    // =====================================
    // 2. GET RECOMMENDED PRODUCTS FOR MARKETPLACE
    // =====================================

    // Step 1: Build filter
    const marketplaceFilter = {
      deleted: false,
      isAvailable: true,
      productType: 2, // Marketplace
      "ratings.overall": { $gt: 0 }, // only products with ratings
    };

    // Step 2: Fetch products
    let marketplaceProducts = await Product.find(marketplaceFilter)
      .select(
        "productName description subCategory price discountedprice images variants ratings productType"
      )
      .lean();

    // Step 3: Add discount percentage for sorting
    marketplaceProducts = marketplaceProducts.map((p) => {
      let discountPercent = 0;
      if (p.price && p.discountedprice) {
        discountPercent = ((p.price - p.discountedprice) / p.price) * 100;
      }
      return { ...p, discountPercent };
    });

    // Step 4: Sort (rating desc, discount% desc)
    marketplaceProducts.sort((a, b) => {
      if (b.ratings.overall !== a.ratings.overall) {
        return b.ratings.overall - a.ratings.overall; // higher rating first
      }
      return b.discountPercent - a.discountPercent; // higher discount next
    });

    // Step 5: Limit results (e.g. top 10)
    marketplaceProducts = marketplaceProducts.slice(0, 10);

    // Step 6: Convert image keys into pre-signed URLs + wishlist/cart/review check
    marketplaceProducts = await Promise.all(
      marketplaceProducts.map(async (product) => {
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
        let isReviewed = false;

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

          // Check if user has reviewed this product
          const review = await Review.findOne({
            productId: product._id,
            userId: customer._id,
            deleted: false,
          });
          isReviewed = !!review;
        }

        return {
          ...product,
          images: updatedImages,
          variants: updatedVariants,
          discountPercent: product.discountPercent.toFixed(2),
          isInWishlist,
          isAddedToCart,
          isReviewed,
        };
      })
    );

    response.marketplaceRecommendations.products = marketplaceProducts;
    response.marketplaceRecommendations.message =
      "Recommended products for marketplace fetched successfully.";

    // =====================================
    // 3. GET RECOMMENDED PRODUCTS FOR MINUTES
    // =====================================

    if (hasValidCoordinates) {
      // Step 1: Get approved vendors (reuse from first section if available)
      const minutesVendors = await VendorDetail.find(
        { profileComplete: true, status: "Approved" },
        { _id: 1, businessName: 1, location: 1, userId: 1 }
      );

      if (minutesVendors.length > 0) {
        // Step 2: Build destinations for Google Distance Matrix
        const minutesDestinations = minutesVendors
          .filter(
            (v) =>
              Array.isArray(v.location?.coordinates) &&
              v.location.coordinates.length === 2
          )
          .map(
            (v) => `${v.location.coordinates[1]},${v.location.coordinates[0]}`
          )
          .join("|");

        if (minutesDestinations) {
          const apiKey = process.env.GOOGLE_MAPS_API_KEY;
          const minutesUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${latitude},${longitude}&destinations=${minutesDestinations}&mode=driving&departure_time=now&traffic_model=best_guess&key=${apiKey}`;

          const minutesGoogleResponse = await axios.get(minutesUrl);
          const minutesData = minutesGoogleResponse.data;

          if (minutesData?.rows?.[0]?.elements?.length) {
            const minutesResults = minutesData.rows[0].elements;

            // Step 3: Filter vendors within 15 minutes
            const minutesFilteredVendors = minutesVendors.reduce(
              (acc, vendor, index) => {
                const travel = minutesResults[index];
                if (travel?.status !== "OK") return acc;

                const travelSeconds =
                  travel.duration_in_traffic?.value || travel.duration?.value;
                if (travelSeconds && travelSeconds / 60 <= 15) {
                  acc.push(vendor.userId);
                }
                return acc;
              },
              []
            );

            if (minutesFilteredVendors.length > 0) {
              // Step 4: Fetch products only from those vendors
              let minutesProducts = await Product.find({
                vendorId: { $in: minutesFilteredVendors },
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
              minutesProducts = minutesProducts.map((p) => {
                let discountPercent = 0;
                if (p.price && p.discountedprice) {
                  discountPercent =
                    ((p.price - p.discountedprice) / p.price) * 100;
                }
                return { ...p, discountPercent };
              });

              // Step 6: Sort (rating desc, discount desc)
              minutesProducts.sort((a, b) => {
                if (b.ratings.overall !== a.ratings.overall) {
                  return b.ratings.overall - a.ratings.overall;
                }
                return b.discountPercent - a.discountPercent;
              });

              // Step 7: Limit top 10
              minutesProducts = minutesProducts.slice(0, 10);

              // Step 8: Wishlist + Cart + Review check
              minutesProducts = await Promise.all(
                minutesProducts.map(async (product) => {
                  let updatedImages = [];
                  if (product.images && product.images.length > 0) {
                    updatedImages = await getPresignedImageUrls(product.images);
                  }

                  const updatedVariants = await Promise.all(
                    (product.variants || []).map(async (variant) => {
                      if (variant.images && variant.images.length > 0) {
                        const urls = await getPresignedImageUrls(
                          variant.images
                        );
                        return { ...variant, images: urls };
                      }
                      return variant;
                    })
                  );

                  let isInWishlist = false;
                  let isAddedToCart = false;
                  let isReviewed = false;

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

                    // Check if user has reviewed this product
                    const review = await Review.findOne({
                      productId: product._id,
                      userId: customer._id,
                      deleted: false,
                    });
                    isReviewed = !!review;
                  }

                  return {
                    ...product,
                    images: updatedImages,
                    variants: updatedVariants,
                    discountPercent: product.discountPercent.toFixed(2),
                    isInWishlist,
                    isAddedToCart,
                    isReviewed,
                  };
                })
              );

              response.minutesRecommendations.products = minutesProducts;
              response.minutesRecommendations.message =
                "Recommended products within 15-minutes fetched successfully.";
            } else {
              response.minutesRecommendations.message =
                "No vendors found within 15-minute delivery radius.";
            }
          } else {
            response.minutesRecommendations.message =
              "Failed to fetch distance data from Google API.";
          }
        } else {
          response.minutesRecommendations.message =
            "Vendor locations invalid or missing.";
        }
      } else {
        response.minutesRecommendations.message = "No approved vendors found.";
      }
    } else {
      response.minutesRecommendations.message =
        "Valid latitude and longitude are required";
    }

    return res.json(response);
  } catch (err) {
    console.error(
      "Error in combined products controller:",
      err.message,
      err.stack
    );
    return res.status(500).json({
      message: "Server error while fetching products and recommendations",
      error: err.message,
    });
  }
};
