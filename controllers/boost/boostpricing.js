import boostprice from "../../models/Boost/boostprice.js";
import JsonRes from "../../helpers/response.js";

const { success, serverError, badRequest } = JsonRes;

export const getBoostPricing = async (req, res) => {
  try {
    const pricing = await boostprice.find().sort({ createdAt: -1 });

    return success(res, pricing, "Boost pricing fetched successfully");
  } catch (err) {
    console.error("getBoostPricing error:", err);
    return serverError(res, err, "Failed to fetch boost pricing");
  }
};

export const updateBoostPricing = async (req, res) => {
  try {
    const { boostType, pricePerDay } = req.body;

    if (!boostType || pricePerDay === undefined) {
      return badRequest(res, "boostType and pricePerDay are required");
    }

    if (pricePerDay < 0) {
      return badRequest(res, "price must be non-negative");
    }

    const updated = await boostprice.findOneAndUpdate(
      { boostType },
      { pricePerDay },
      { new: true, upsert: true }
    );

    return success(res, updated, "Boost pricing updated successfully");
  } catch (err) {
    console.error("updateBoostPricing error:", err);
    return serverError(res, err, "Failed to update boost pricing");
  }
};


