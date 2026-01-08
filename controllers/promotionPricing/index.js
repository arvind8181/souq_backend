// controllers/promotionPricing/promotionPricingController.js
import JsonRes from "../../helpers/response.js";
import PromotionPricing from "../../models/promotionPricing/promotionPricing.js";

const { badRequest, success, serverError, notFound } = JsonRes;

/*──────────────────── Get Promotion Pricing ────────────────────*/
export const getPromotionPricing = async (req, res) => {
  try {
    const { type } = req.query;

    // Build filter
    const filter = {};
    if (type) filter.type = type;

    const promotions = await PromotionPricing.find(filter).sort({
      createdAt: -1,
    });

    if (!promotions || promotions.length === 0) {
      return notFound(res, "No promotion pricing records found.");
    }

    return success(
      res,
      promotions,
      "Promotion pricing retrieved successfully."
    );
  } catch (err) {
    console.error("Error in getPromotionPricing:", err);
    return serverError(res, err, "Failed to retrieve promotion pricing.");
  }
};

/*──────────────────── Update Promotion Pricing ────────────────────*/
export const updatePromotionPricing = async (req, res) => {
  try {
    const { type, price, pricingType } = req.body;

    // Validate input
    if (!type || price === undefined) {
      return badRequest(res, "type and price are required.");
    }

    if (price < 0) {
      return badRequest(res, "price must be a non-negative number.");
    }

    // Build update object dynamically
    const updateData = { price };
    if (pricingType) updateData.pricingType = pricingType;

    // Update record
    const updatedPromotionPricing = await PromotionPricing.findOneAndUpdate(
      { type },
      updateData,
      { new: true }
    );

    if (!updatedPromotionPricing) {
      return notFound(
        res,
        "Promotion pricing record not found for given type."
      );
    }

    return success(
      res,
      updatedPromotionPricing,
      "Promotion pricing updated successfully."
    );
  } catch (err) {
    console.error("Error in updatePromotionPricing:", err);
    return serverError(res, err, "Failed to update promotion pricing.");
  }
};
