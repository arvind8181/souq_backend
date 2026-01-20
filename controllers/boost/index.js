import JsonRes from "../../helpers/response.js";
import Boost from "../../models/Boost/BoostSchema.js";
import Product from "../../models/product/products.js";

const { success, serverError, badRequest, notFound } = JsonRes;

export const addBoost = async (req, res) => {
  try {
    const vendorId = req.user.id;

    const { boost_type, scope_type, scope_ids, duration, price, start_date } =
      req.body;

    const conflictBoost = await Boost.findOne({
      vendorId,
      boost_type,
      scope_type,
      scope_ids: { $in: scope_ids },
      status: { $in: ["active", "scheduled"] },
    });

    if (conflictBoost) {
      return badRequest(res, "A boost already exists for selected scope.");
    }

    // Calculate end date based on duration
    const startDateObj = new Date(start_date);
    const endDateObj = new Date(startDateObj);
    endDateObj.setDate(endDateObj.getDate() + duration.value);

    const boost = new Boost({
      vendorId,
      boost_type,
      scope_type,
      scope_ids,
      duration,
      price,
      start_date: startDateObj,
      end_date: endDateObj,
      status: "scheduled",
    });

    await boost.save();

    return success(res, boost, "Boost created successfully.");
  } catch (err) {
    console.error("Boost creation error:", err);
    return serverError(res, err, "Failed to create boost.");
  }
};

export const updateBoost = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { id } = req.params;

    const { boost_type, scope_type, scope_ids, duration, price, start_date } =
      req.body;
    const conflictBoost = await Boost.findOne({
      _id: { $ne: id },
      vendorId,
      boost_type,
      scope_type,
      scope_ids: { $in: scope_ids },
      status: { $in: ["active", "scheduled"] },
    });

    if (conflictBoost) {
      return badRequest(res, "A boost already exists for selected scope.");
    }
    const startDateObj = new Date(start_date);
    const endDateObj = new Date(startDateObj);
    endDateObj.setDate(endDateObj.getDate() + duration.value);

    const updatedBoost = await Boost.findOneAndUpdate(
      { _id: id, vendorId },
      {
        boost_type,
        scope_type,
        scope_ids,
        duration,
        price,
        start_date: startDateObj,
        end_date: endDateObj,
        status: "scheduled",
      },
      { new: true }, 
    );

    if (!updatedBoost) {
      return badRequest(res, "Boost not found.");
    }

    return success(res, updatedBoost, "Boost updated successfully.");
  } catch (err) {
    console.error("Boost update error:", err);
    return serverError(res, err, "Failed to update boost.");
  }
};

export const getBoosts = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { boostType } = req.query;

    const query = { vendorId };

    if (boostType) {
      query.boost_type = boostType;
    }

    const boosts = await Boost.find(query)
      .populate({
        path: "scope_ids",
        select: "productName name price",
      })
      .sort({ createdAt: -1 });

    return success(res, boosts, "Boosts fetched successfully.");
  } catch (err) {
    console.error("Fetch boosts error:", err);
    return serverError(res, err, "Failed to fetch boosts.");
  }
};

export const stopBoost = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { id } = req.params;

    const boost = await Boost.findOneAndUpdate(
      {
        _id: id,
        vendorId,
        status: "active",
      },
      {
        status: "stopped",
        end_date: new Date(),
      },
      { new: true },
    );

    if (!boost) {
      return notFound(res, null, "Active boost not found.");
    }

    return success(res, boost, "Boost stopped successfully.");
  } catch (err) {
    console.error("Stop boost error:", err);
    return serverError(res, err, "Failed to stop boost.");
  }
};

export const deleteBoost = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { id } = req.params;

    const boost = await Boost.findOneAndUpdate(
      {
        _id: id,
        vendorId,
        status: { $in: ["draft", "expired"] },
      },
      { isDeleted: true },
      { new: true },
    );

    if (!boost) {
      return badRequest(res, "Cannot delete active boost.");
    }

    return success(res, null, "Boost deleted successfully.");
  } catch (err) {
    console.error("Delete boost error:", err);
    return serverError(res, err, "Failed to delete boost.");
  }
};

export const getAllBoosts = async (req, res) => {
  try {
    const boosts = await Boost.find().populate("vendorId", "name email");

    return success(res, boosts, "All boosts fetched successfully.");
  } catch (err) {
    console.error("Admin boost fetch error:", err);
    return serverError(res, err, "Failed to fetch boosts.");
  }
};

export const updateStatus = async (req, res) => {
  try {
    const { id, status } = req.body;

    if (!["active", "expired", "stopped"].includes(status)) {
      return badRequest(res, "Invalid status value.");
    }

    const boost = await Boost.findOneAndUpdate(
      { _id: id },
      { status },
      { new: true },
    );

    if (!boost) {
      return notFound(res, null, "Boost not found.");
    }

    return success(res, boost, "Boost status updated successfully.");
  } catch (err) {
    console.error("Update boost status error:", err);
    return serverError(res, err, "Failed to update boost status.");
  }
};
