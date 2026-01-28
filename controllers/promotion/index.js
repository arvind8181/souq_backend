import { hash } from "bcryptjs";
import JsonRes from "../../helpers/response.js";
import User from "../../models/user/user.js";

import VendorDetail from "../../models/vendorDetails/vendorDetails.js";
import jwt from "jsonwebtoken";
import { calculateDays, ROLES } from "../../utils/constant.js";
import crypto from "crypto";
import { COLORS } from "../../utils/constant.js";
import { sendMail } from "../../helpers/mail.js";
import { convertTimeToUTC } from "../../helpers/utc.js";
import Promotion from "../../models/promotionSchema/promotionSchema.js";
import Product from "../../models/product/products.js";
import { getPresignedImageUrls } from "../../services/s3Service.js";
import BoostPricing from "../../models/Boost/boostprice.js";
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

export const addPromotion = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const {
      title,
      description,
      discountType,
      discountValue,
      scopeType,
      type,
      productIds,
      promotionCode,
      paidFlag,
      categoryIds,
      subCategoryNames,
      startDate,
      endDate,
      hours,
      boost,
    } = req.body;

    if (type === "promotion" && promotionCode) {
      const exists = await Promotion.findOne({
        vendorId,
        promotionCode: promotionCode.toUpperCase(),
      });
      if (exists) {
        return error(res, "Promotion code already in use.");
      }
    }
    let boostDetails = null;

    if (boost?.isApplied && boost?.type) {
      if (!startDate || !endDate) {
        return badRequest(res, "Start and End date required for boost");
      }

      const boostPricing = await BoostPricing.findOne({
        boostType: boost.type,
      });

      if (!boostPricing) {
        return badRequest(res, "Invalid boost type");
      }

      const boostDays = calculateDays(startDate, endDate);

      let targetCount = 0;

      if (scopeType === "product") {
        targetCount = productIds?.length || 0;
      }

      if (scopeType === "category") {
        targetCount = categoryIds?.length || 0;
      }

      if (scopeType === "subcategory") {
        targetCount = subCategoryNames?.length || 0;
      }

      if (targetCount === 0) {
        return badRequest(res, "No targets selected for boost");
      }

      const totalBoostPrice =
        boostPricing.pricePerDay * boostDays * targetCount;

      boostDetails = {
        isApplied: true,
        type: boost.type,
        appliedOn: boost.appliedOn,
        pricePerDay: boostPricing.pricePerDay,
        days: boostDays,
        targetCount,
        totalPrice: totalBoostPrice,
      };
    }
    const promotion = new Promotion({
      vendorId,
      title,
      scopeType,
      description,
      type,
      categoryIds,
      productIds,
      discountType,
      discountValue,
      paidFlag: paidFlag || null,
      hours: type === "flash-sale" ? hours : null,
      promotionCode: promotionCode ? promotionCode.toUpperCase() : undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      boost: boostDetails,
    });

    await promotion.save();

    return success(res, promotion, "Promotion created successfully.");
  } catch (err) {
    console.error("Promotion creation error:", err);
    return serverError(res, err, "Failed to create promotion.");
  }
};

export const getPromotions = async (req, res) => {
  try {
    const vendorId = req.user.id;

    // ───── extract filters from query ─────
    const { search = "", type } = req.query;

    // build query object
    const query = {
      vendorId,
      isDeleted: false,
    };

    // apply search by title (case insensitive)
    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    // apply type filter
    if (type) {
      query.type = { $regex: `^${type}$`, $options: "i" };
    }

    // ───── fetch promotions with filters ─────
    const rawPromotions = await Promotion.find(query)
      .sort({ createdAt: -1 })
      .populate({
        path: "productIds",
        populate: {
          path: "category",
          select: "category subCategory color commission images variants",
        },
      })
      .populate({
        path: "categoryIds",
        select: "category",
      });

    // ───── enrich product images with presigned urls ─────
    const promotions = await Promise.all(
      rawPromotions.map(async (promotion) => {
        const plainPromo = promotion.toObject();

        const enrichedProducts = await Promise.all(
          (plainPromo.productIds || []).map(async (product) => {
            const plainProduct = { ...product };

            // Replace product images with presigned URLs
            if (plainProduct.images?.length > 0) {
              plainProduct.images = await getPresignedImageUrls(
                plainProduct.images,
              );
            }

            // Replace variant images
            if (plainProduct.variants?.length > 0) {
              plainProduct.variants = await Promise.all(
                plainProduct.variants.map(async (variant) => {
                  if (variant.images?.length > 0) {
                    variant.images = await getPresignedImageUrls(
                      variant.images,
                    );
                  }
                  return variant;
                }),
              );
            }

            return plainProduct;
          }),
        );

        return {
          ...plainPromo,
          productIds: enrichedProducts,
        };
      }),
    );

    return success(res, promotions, "Promotions fetched successfully.");
  } catch (err) {
    console.error("Error fetching promotions:", err);
    return serverError(res, err, "Failed to fetch promotions.");
  }
};

export const updatePromotion = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { boost } = req.body;
    const { id } = req.params;

    const {
      title,
      description,
      discountType,
      discountValue,
      scopeType,
      type,
      subCategoryNames,
      productIds,
      categoryIds,
      promotionCode,
      paidFlag,
      startDate,
      endDate,
      hours,
    } = req.body;

    const promotion = await Promotion.findOne({ _id: id, vendorId });

    if (!promotion) {
      return notFound(res, null, "Promotion not found.");
    }

    // -------- BASIC FIELDS --------
    if (title !== undefined) promotion.title = title;
    if (description !== undefined) promotion.description = description;
    if (promotionCode !== undefined && promotionCode !== "") {
      promotion.promotionCode = promotionCode;
    }
    if (paidFlag !== undefined) promotion.paidFlag = paidFlag;
    if (type !== undefined) promotion.type = type;

    // -------- DISCOUNT --------
    if (discountType !== undefined) {
      promotion.discountType = discountType;
    }

    if (discountValue !== undefined) {
      promotion.discountValue = discountValue;
    }

    // -------- SCOPE HANDLING (IMPORTANT) --------
    if (scopeType !== undefined) {
      promotion.scopeType = scopeType;
    }

    if (scopeType === "product") {
      promotion.productIds = productIds;
      promotion.categoryIds = [];
      promotion.subCategoryNames = [];
    }

    if (scopeType === "category") {
      promotion.categoryIds = categoryIds;
      promotion.productIds = [];
      promotion.subCategoryNames = subCategoryNames || [];
    }
    // -------- DATE & FLASH-SALE LOGIC --------
    if (type === "flash-sale") {
      promotion.hours = hours;
      promotion.endDate = null;
      promotion.startDate = startDate
        ? new Date(startDate)
        : promotion.startDate;
    } else {
      promotion.hours = null;
      if (startDate) promotion.startDate = new Date(startDate);
      if (endDate) promotion.endDate = new Date(endDate);
    }
    if (boost?.isApplied) {
      if (!promotion.startDate || !promotion.endDate) {
        return badRequest(res, "Start and End date required for boost");
      }

      const days = calculateDays(promotion.startDate, promotion.endDate);

      let targetCount = 0;

      if (promotion.scopeType === "product") {
        targetCount = promotion.productIds?.length || 0;
      }

      if (promotion.scopeType === "category") {
        targetCount = promotion.categoryIds?.length || 0;
      }

      if (promotion.scopeType === "subcategory") {
        targetCount = promotion.subCategoryNames?.length || 0;
      }

      if (targetCount === 0) {
        return badRequest(res, "No targets selected for boost");
      }

      const boostPrice = await BoostPricing.findOne({
        boostType: boost.type,
      });

      if (!boostPrice) {
        return badRequest(res, "Boost pricing not found");
      }

      promotion.boost = {
        isApplied: true,
        type: boost.type,
        appliedOn: boost.appliedOn,
        pricePerDay: boostPrice.pricePerDay,
        days,
        targetCount,
        totalPrice: boostPrice.pricePerDay * days * targetCount,
      };
    } else {
      promotion.boost = {
        isApplied: false,
        type: null,
        appliedOn: null,
        pricePerDay: 0,
        days: 0,
        targetCount: 0,
        totalPrice: 0,
      };
      await Product.updateMany(
        { _id: { $in: promotion.productIds } },
        { $set: { isFeatured: false, isTopListed: false } },
      );
    }

    await promotion.save();
    if (promotion.boost?.isApplied) {
      // FEATURED BADGE (PRODUCT ONLY)
      if (promotion.boost.type === "featured") {
        await Product.updateMany(
          { _id: { $in: promotion.productIds } },
          { $set: { isFeatured: true } },
        );
      }

      // TOP OF LIST (PRODUCT ONLY)
      if (promotion.boost.type === "top") {
        await Product.updateMany(
          { _id: { $in: promotion.productIds } },
          { $set: { isTopListed: true } },
        );
      }

      // DIRECT NOTIFICATION (CATEGORY / SUBCATEGORY)
      if (promotion.boost.type === "notification") {
        let products = [];

        if (promotion.scopeType === "category") {
          products = await Product.find({
            vendorId,
            category: { $in: promotion.categoryIds },
          });
        }

        if (promotion.scopeType === "subcategory") {
          products = await Product.find({
            vendorId,
            subCategory: { $in: promotion.subCategoryNames },
          });
        }

        // 🔔 Trigger notification here
        // sendNotificationToUsers(products, promotion);
      }
    }
    return success(res, promotion, "Promotion updated successfully.");
  } catch (err) {
    console.error("Update promotion error:", err);
    return serverError(res, err, "Failed to update promotion.");
  }
};

export const deletePromotion = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { id } = req.params;

    const promotion = await Promotion.findOneAndUpdate(
      { _id: id, vendorId, isDeleted: false },
      { isDeleted: true },
      { new: true },
    );

    if (!promotion) {
      return notFound(res, null, "Promotion not found or already deleted.");
    }

    return success(res, null, "Promotion deleted successfully.");
  } catch (err) {
    console.error("Delete promotion error:", err);
    return serverError(res, err, "Failed to delete promotion.");
  }
};

export const getAllPromotions = async (req, res) => {
  try {
    const {
      title,
      type,
      promotionCode,
      isActive,
      page = 1,
      limit = 10,
    } = req.query;
    const pageNumber = parseInt(page, 10);
    const pageLimit = parseInt(limit, 10);

    let filter = {};

    // Search by specific fields
    if (title) {
      filter.title = { $regex: title, $options: "i" };
    }
    if (type) {
      filter.type = { $regex: type, $options: "i" };
    }
    if (promotionCode) {
      filter.promotionCode = { $regex: promotionCode, $options: "i" };
    }

    // Filter by isActive (true/false)
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    // Total count for pagination
    const totalCount = await Promotion.countDocuments(filter);

    // Fetch paginated promotions
    const rawPromotions = await Promotion.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * pageLimit)
      .limit(pageLimit)
      .populate({
        path: "productIds",
        populate: {
          path: "category",
          select: "category subCategory color commission images variants",
        },
      });

    // Enhance products with presigned URLs
    const promotions = await Promise.all(
      rawPromotions.map(async (promotion) => {
        const plainPromo = promotion.toObject();

        const enrichedProducts = await Promise.all(
          (plainPromo.productIds || []).map(async (product) => {
            const plainProduct = { ...product };

            if (plainProduct.images?.length) {
              plainProduct.images = await getPresignedImageUrls(
                plainProduct.images,
              );
            }

            if (plainProduct.variants?.length) {
              plainProduct.variants = await Promise.all(
                plainProduct.variants.map(async (variant) => {
                  if (variant.images?.length) {
                    variant.images = await getPresignedImageUrls(
                      variant.images,
                    );
                  }
                  return variant;
                }),
              );
            }

            return plainProduct;
          }),
        );

        return {
          ...plainPromo,
          productIds: enrichedProducts,
        };
      }),
    );

    return success(
      res,
      {
        data: promotions,
        totalRecords: totalCount,
        currentPage: pageNumber,
        pageSize: pageLimit,
      },
      "Promotions fetched successfully.",
    );
  } catch (err) {
    console.error("Error fetching promotions:", err);
    return serverError(res, err, "Failed to fetch promotions.");
  }
};

export const updateStatus = async (req, res) => {
  try {
    const { id, isDeleted, isActive } = req.body;

    // Build update object dynamically
    const updateFields = {};
    if (typeof isDeleted === "boolean") updateFields.isDeleted = isDeleted;
    if (typeof isActive === "boolean") updateFields.isActive = isActive;

    if (Object.keys(updateFields).length === 0) {
      return badRequest(res, "No valid status fields provided.");
    }

    const promotion = await Promotion.findOneAndUpdate(
      { _id: id },
      updateFields,
      { new: true },
    );

    if (!promotion) {
      return notFound(res, "Promotion not found.");
    }

    return success(res, promotion, "Promotion status updated successfully.");
  } catch (err) {
    console.error("Error updating promotion status:", err);
    return serverError(res, err, "Failed to update promotion status.");
  }
};
