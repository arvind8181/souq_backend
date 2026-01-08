// controllers/addonPricing/addonPricingController.js
import JsonRes from "../../helpers/response.js";
import AddonPricing from "../../models/addonPricing/addonPricing.js";

const { badRequest, success, serverError, notFound } = JsonRes;

/*──────────────────── Get Addon Pricing ────────────────────*/
export const getAddonPricing = async (req, res) => {
  try {
    const { addonName } = req.query;

    // Build filter
    const filter = {};
    if (addonName) filter.addonName = addonName;

    const addons = await AddonPricing.find(filter).sort({ createdAt: -1 });

    if (!addons || addons.length === 0) {
      return notFound(res, "No addon pricing records found.");
    }

    return success(res, addons, "Addon pricing retrieved successfully.");
  } catch (err) {
    console.error("Error in getAddonPricing:", err);
    return serverError(res, err, "Failed to retrieve addon pricing.");
  }
};

/*──────────────────── Update Addon Pricing ────────────────────*/
export const updateAddonPricing = async (req, res) => {
  try {
    const { addonName, price, days, pricingType } = req.body;

    // Validate input
    if (!addonName || price === undefined) {
      return badRequest(res, "addonName and price are required.");
    }

    if (price < 0) {
      return badRequest(res, "price must be a non-negative number.");
    }

    // Build update object dynamically
    const updateData = { price };
    if (days !== undefined) updateData.days = days;
    if (pricingType) updateData.pricingType = pricingType;

    // Update record
    const updatedAddonPricing = await AddonPricing.findOneAndUpdate(
      { addonName },
      updateData,
      { new: true }
    );

    if (!updatedAddonPricing) {
      return notFound(
        res,
        "Addon pricing record not found for given addonName."
      );
    }

    return success(
      res,
      updatedAddonPricing,
      "Addon pricing updated successfully."
    );
  } catch (err) {
    console.error("Error in updateAddonPricing:", err);
    return serverError(res, err, "Failed to update addon pricing.");
  }
};
