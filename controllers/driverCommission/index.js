import JsonRes from "../../helpers/response.js";
import DriverCommission from "../../models/driverCommission/driverCommission.js";
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

export const getCommission = async (req, res) => {
  try {
    // Optional query params: ?driverType=full_time&vehicle=van
    const { driverType, vehicle, isActive } = req.query;

    // Build a dynamic filter
    const filter = {};
    if (driverType) filter.driverType = driverType;
    if (vehicle) filter.vehicle = vehicle;
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const commissions = await DriverCommission.find(filter).sort({
      effectiveFrom: -1,
    });

    if (!commissions || commissions.length === 0) {
      return notFound(res, "No commission records found.");
    }

    return success(
      res,
      commissions,
      "Driver commissions retrieved successfully."
    );
  } catch (err) {
    console.error("Error in getCommission:", err);
    return serverError(res, err, "Failed to retrieve driver commission.");
  }
};

export const updateCommission = async (req, res) => {
  try {
    const { driverType, vehicle, commissionPercentage } = req.body;

    // Validate input
    if (!driverType || !vehicle || commissionPercentage === undefined) {
      return badRequest(
        res,
        "driverType, vehicle, and commissionPercentage are required."
      );
    }

    // Ensure commission is in range
    if (commissionPercentage < 0 || commissionPercentage > 100) {
      return badRequest(res, "commissionPercentage must be between 0 and 100.");
    }

    // Find and update
    const updatedCommission = await DriverCommission.findOneAndUpdate(
      { driverType, vehicle }, // filter
      { commissionPercentage }, // update
      { new: true } // return updated document
    );

    if (!updatedCommission) {
      return notFound(
        res,
        "Commission record not found for given driverType and vehicle."
      );
    }

    return success(
      res,
      updatedCommission,
      "Driver commission updated successfully."
    );
  } catch (err) {
    console.error("Error in updateCommission:", err);
    return serverError(res, err, "Failed to update driver commission.");
  }
};
