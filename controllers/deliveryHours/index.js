import { hash } from "bcryptjs";
import JsonRes from "../../helpers/response.js";
import User from "../../models/user/user.js";
import VendorDeliveryHour from "../../models/deliveryHours/deliveryHours.js";
import Product from "../../models/product/products.js";
import jwt from "jsonwebtoken";
import { ROLES } from "../../utils/constant.js";
import { convertTimeToUTC } from "../../helpers/utc.js";
const {
  badRequest,
  conflict,
  success,
  serverError,
  failed,
  dataCreated,
  unauthorized,
} = JsonRes;
// Create or update a delivery hour for a specific day
export const createOrUpdateDeliveryHour = async (req, res) => {
  try {
    const { hours } = req.body; // Expecting an array of 7 objects: { day, isDayOff, openTime, closeTime }
    const vendorId = req.user.id;

    if (!Array.isArray(hours) || hours.length !== 7) {
      return badRequest(res, "Expected an array of 7 days for delivery hours.");
    }

    const results = [];

    for (const hour of hours) {
      const { day, isDayOff, openTime, closeTime } = hour;

      const utcOpenTime = convertTimeToUTC(openTime);
      const utcCloseTime = convertTimeToUTC(closeTime);

      const existing = await VendorDeliveryHour.findOne({ vendorId, day });

      if (existing) {
        existing.isDayOff = isDayOff;
        existing.openTime = utcOpenTime;
        existing.closeTime = utcCloseTime;
        await existing.save();
        results.push({ day, status: "updated", id: existing._id });
      } else {
        const created = await VendorDeliveryHour.create({
          vendorId,
          day,
          isDayOff,
          openTime: utcOpenTime,
          closeTime: utcCloseTime,
        });
        results.push({ day, status: "created", id: created._id });
      }
    }

    return success(res, results, "Delivery hours processed successfully.");
  } catch (error) {
    console.error("Error processing delivery hours:", error);
    return serverError(res, error, "Failed to process delivery hours.");
  }
};

// Get all delivery hours for the vendor
export const getVendorDeliveryHours = async (req, res) => {
  try {
    const vendorId = req.user.id;

    const hours = await VendorDeliveryHour.find({ vendorId }).sort({ day: 1 });
    if (!hours || hours.length === 0) {
      return success(res, [], "No delivery hours found.");
    }
    return success(res, hours, "Delivery hours fetched successfully.");
  } catch (error) {
    console.error("Get delivery hours error:", error);
    return serverError(res, error, "Failed to fetch delivery hours.");
  }
};
