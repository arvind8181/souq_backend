import Address from "../../models/address/address.js";
import JsonRes from "../../helpers/response.js";

const { success, badRequest, serverError, notFound } = JsonRes;

// Add new address
export const addAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      label,
      buildingNo,
      apartmentNo,
      floorNo,
      street,
      city,
      landmark,
      pincode,
      phone,
      isDefault,
      coordinates,
    } = req.body;

    if (
      !label ||
      !buildingNo ||
      !apartmentNo ||
      !floorNo ||
      !street ||
      !city ||
      !landmark ||
      !pincode ||
      !phone
    ) {
      return badRequest(res, null, "All fields are required.");
    }

    if (
      coordinates &&
      (typeof coordinates.latitude !== "number" ||
        typeof coordinates.longitude !== "number" ||
        coordinates.latitude < -90 ||
        coordinates.latitude > 90 ||
        coordinates.longitude < -180 ||
        coordinates.longitude > 180)
    ) {
      return badRequest(res, null, "Valid latitude and longitude are required.");
    }

    // If setting as default, unset previous default
    if (isDefault) {
      await Address.updateMany({ userId }, { $set: { isDefault: false } });
    }

    const newAddress = await Address.create({
      userId,
      label,
      buildingNo,
      apartmentNo,
      floorNo,
      street,
      city,
      landmark,
      pincode,
      phone,
      coordinates,
      isDefault,
    });

    return success(res, newAddress, "Address added successfully.");
  } catch (error) {
    console.error("Error adding address:", error);
    return serverError(res, error, "Failed to add address.");
  }
};


//  Get all addresses for user
export const getAddresses = async (req, res) => {
  try {
    const userId = req.user.id;

    const { page = 1, pageSize = 10 } = req.query;

    const skip = (page - 1) * pageSize;

    const addresses = await Address.find({ userId })
      .sort({ isDefault: -1, updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(pageSize));

    const totalRecords = await Address.countDocuments({ userId });

    return success(
      res,
      {
        data: addresses,
        totalRecords,
        currentPage: parseInt(page),
        pageSize: parseInt(pageSize),
      },
      "Addresses fetched successfully."
    );
  } catch (error) {
    console.error("Error fetching addresses:", error);
    return serverError(res, error, "Failed to fetch addresses.");
  }
};

//  Set a specific address as default
export const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { addressId } = req.params;

    const address = await Address.findOne({ _id: addressId, userId });
    if (!address) {
      return notFound(res, null, "Address not found.");
    }

    // Unset other defaults
    await Address.updateMany(
      { userId },
      { $set: { isDefault: false } }
    );

    // Set this one as default
    address.isDefault = true;
    await address.save();

    return success(res, address, "Default address set successfully.");
  } catch (error) {
    console.error("Error setting default address:", error);
    return serverError(res, error, "Failed to set default address.");
  }
};

//  Delete an address
export const deleteAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { addressId } = req.params;

    const address = await Address.findOneAndDelete({ _id: addressId, userId });
    if (!address) {
      return notFound(res, null, "Address not found or already deleted.");
    }

    return success(res, null, "Address deleted successfully.");
  } catch (error) {
    console.error("Error deleting address:", error);
    return serverError(res, error, "Failed to delete address.");
  }
};
