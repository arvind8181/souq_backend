import Advertisement from "../../models/advertisement/advertisement.js";
import CustomerDetail from "../../models/customerDetails/customerDetails.js";
import Favorite from "../../models/favourite/favourite.js";
import JsonRes from "../../helpers/response.js";
import { ResponseMessage, S3TYPE } from "../../utils/constant.js";
import {
  uploadImage,
  getPresignedImageUrls,
  deleteObject,
} from "../../services/s3Service.js";

// Create Advertisement
export const createAdvertisement = async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      negotiable,
      email,
      phone,
      location,
      category,
      agent,
      contactPreferences_preferredMethod,
      contactPreferences_preferredTime,
      ...rest
    } = req.body;

    if (!title || !email || !phone || !location || !category) {
      return JsonRes.badRequest(res, null, ResponseMessage.BAD_REQUEST);
    }

    const userId = req.user.id;

    //  Get CustomerDetail for user
    const customerDetail = await CustomerDetail.findOne({ userId });
    if (!customerDetail) {
      return JsonRes.notFound(res, null, "Customer detail not found.");
    }

    // Upload images to S3
    const files = req.compressedFiles?.images || [];
    const adImages = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const s3Key = `${S3TYPE.ADVERTISEMENT}/${userId}/${Date.now()}_${i}.jpg`;
      await uploadImage({ buffer: file.buffer, s3Name: s3Key });
      adImages.push(s3Key);
    }

    const adData = {
      customerId: customerDetail._id,
      title,
      description,
      price,
      negotiable,
      email,
      phone,
      location,
      images: adImages,
      category,
      agent,
      contactPreferences_preferredMethod,
      contactPreferences_preferredTime,
      ...rest,
    };

    const newAd = await Advertisement.create(adData);

    return JsonRes.dataCreated(res, newAd, ResponseMessage.DATA_CREATED);
  } catch (error) {
    console.error("Error creating advertisement:", error);
    return JsonRes.serverError(res, error, ResponseMessage.SERVER_ERROR);
  }
};

//  Get All Advertisements
export const getAdvertisements = async (req, res) => {
  try {
    const {
      category,
      minPrice,
      maxPrice,
      reported,
      search,
      page = 1,
      limit = 10,
      myAds, // 🆕 Query param for user-specific ads
      ...filters
    } = req.query;

    const query = {};

    if (category) query.category = category;

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }
    if (reported !== undefined) {
      query.reported = reported === "true";
    }
    if (myAds === "true") {
      const userId = req.user.id;
      const customerDetail = await CustomerDetail.findOne({ userId });
      if (customerDetail) {
        query.customerId = customerDetail._id;
      }
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [{ title: searchRegex }, { description: searchRegex }];
    }

    Object.assign(query, filters);

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Advertisement.countDocuments(query);
    const totalads = await Advertisement.countDocuments();
    const rawAds = await Advertisement.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("customerId", "FullName email"); // 🆕 Populate customer info

    const ads = await Promise.all(
      rawAds.map(async (ad) => {
        const plainAd = ad.toObject();
        if (plainAd.images?.length) {
          plainAd.images = await getPresignedImageUrls(plainAd.images);
        }
        return plainAd;
      })
    );
    const notReportedCount = await Advertisement.countDocuments({
      ...query,
      reported: false,
    });

    if (!ads.length) {
      return JsonRes.success(
        res,
        {
          advertisements: [],
          pagination: {
            totalRecords: total,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            pageSize: parseInt(limit),
          },
          totalads,
          notReportedCount,
        },
        ResponseMessage.DATA_FETCHED
      );
    }

    return JsonRes.success(
      res,
      {
        advertisements: ads,
        pagination: {
          totalRecords: total,
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          pageSize: parseInt(limit),
        },
        totalads,
        notReportedCount,
      },
      ResponseMessage.DATA_FETCHED
    );
  } catch (error) {
    console.error("Error fetching advertisements:", error);
    return JsonRes.serverError(res, error, ResponseMessage.SERVER_ERROR);
  }
};

//  Get Advertisement by ID
export const getAdvertisementById = async (req, res) => {
  try {
    const userId = req.user.id;

    // 📝 Get customerId if req.user.id is userId
    const customer = await CustomerDetail.findOne({ userId });
    if (!customer) {
      return JsonRes.notFound(res, null, "Customer not found.");
    }
    const customerId = customer._id;

    const { id } = req.params;
    const ad = await Advertisement.findById(id).populate(
      "customerId",
      "FullName email phone"
    );

    if (!ad) {
      return JsonRes.notFound(res, null, ResponseMessage.DATA_NOT_FOUND);
    }

    const plainAd = ad.toObject();

    // Add presigned image URLs if any
    if (plainAd.images?.length) {
      plainAd.images = await getPresignedImageUrls(plainAd.images);
    }

    // 🏎️ Get all favorite advertisement IDs for this customer
    const favoriteAdIds = await Favorite.find({ customerId })
      .distinct("advertisementId");

    // Check if this advertisement is in favorites
    const isFav = favoriteAdIds.some(
      (favId) => favId.toString() === plainAd._id.toString()
    );
    plainAd.isFavourite = isFav;

    return JsonRes.success(res, plainAd, ResponseMessage.DATA_FETCHED);
  } catch (error) {
    console.error("Error fetching advertisement by ID:", error);
    return JsonRes.serverError(res, error, ResponseMessage.SERVER_ERROR);
  }
};



//  Get Advertisements by Current User
export const getMyAdvertisements = async (req, res) => {
  try {
    const userId = req.user.id;
    const customerDetail = await CustomerDetail.findOne({ userId });
    if (!customerDetail) {
      return JsonRes.notFound(res, null, "Customer detail not found.");
    }

    const ads = await Advertisement.find({ customerId: customerDetail._id })
      .sort({ createdAt: -1 })
      .populate("customerId", "FullName email phone");

    const adsWithImages = await Promise.all(
      ads.map(async (ad) => {
        const plainAd = ad.toObject();
        if (plainAd.images?.length) {
          plainAd.images = await getPresignedImageUrls(plainAd.images);
        }
        return plainAd;
      })
    );

    return JsonRes.success(
      res,
      { advertisements: adsWithImages },
      ResponseMessage.DATA_FETCHED
    );
  } catch (error) {
    console.error("Error fetching user advertisements:", error);
    return JsonRes.serverError(res, error, ResponseMessage.SERVER_ERROR);
  }
};


export const updateAdvertisement = async (req, res) => {
  try {
    const { id } = req.params;

    // Get ad with populated customerId.userId
    const ad = await Advertisement.findById(id).populate(
      "customerId",
      "userId"
    );

    if (!ad) {
      return JsonRes.notFound(res, null, ResponseMessage.DATA_NOT_FOUND);
    }

    // Check if current user is owner
    if (String(ad.customerId.userId) !== String(req.user.id)) {
      return JsonRes.forbidden(
        res,
        null,
        "You are not allowed to update this advertisement."
      );
    }

    const userId = req.user.id;

    // Handle images
    if (req.body.retainedImages || req.files?.images) {
      const retainedImages = req.body.retainedImages || [];
      const newImages = [];

      const files = req.files?.images || [];
      for (const file of files) {
        const s3Key = `${S3TYPE.ADVERTISEMENT}/${userId}/${Date.now()}_${
          file.originalname
        }`;
        await uploadImage({ buffer: file.buffer, s3Name: s3Key });
        newImages.push(s3Key);
      }

      const allNewKeys = [...retainedImages, ...newImages];
      for (const oldKey of ad.images) {
        if (!allNewKeys.includes(oldKey)) {
          await deleteObject(oldKey);
        }
      }
      ad.images = allNewKeys;
    }

    Object.assign(ad, req.body);
    ad.updatedAt = Date.now();
    await ad.save();

    return JsonRes.success(res, ad, ResponseMessage.DATA_UPDATED);
  } catch (error) {
    console.error("Error updating advertisement:", error);
    return JsonRes.serverError(res, error, ResponseMessage.SERVER_ERROR);
  }
};

// Delete AdvertisementBY customer...
export const deleteAdvertisement = async (req, res) => {
  try {
    const { id } = req.params;
    const ad = await Advertisement.findById(id).populate(
      "customerId",
      "userId"
    );

    if (!ad) {
      return JsonRes.notFound(res, null, ResponseMessage.DATA_NOT_FOUND);
    }

    if (String(ad.customerId.userId) !== String(req.user.id)) {
      return JsonRes.forbidden(
        res,
        null,
        "You are not allowed to delete this advertisement."
      );
    }

    // Delete images from S3
    for (const s3Key of ad.images || []) {
      await deleteObject(s3Key);
    }

    await ad.deleteOne();

    return JsonRes.success(res, null, ResponseMessage.DATA_DELETED);
  } catch (error) {
    console.error("Error deleting advertisement:", error);
    return JsonRes.serverError(res, error, ResponseMessage.SERVER_ERROR);
  }
};


//Delete AdvertisementBY admin...
export const deleteAdvertisementByAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const ad = await Advertisement.findById(id);

    if (!ad) {
      return JsonRes.notFound(res, null, ResponseMessage.DATA_NOT_FOUND);
    }

    // ✅ Delete images from S3 if they exist
    if (ad.images && ad.images.length > 0) {
      for (const s3Key of ad.images) {
        await deleteObject(s3Key);
      }
    }

    await ad.deleteOne();

    return JsonRes.success(res, null, ResponseMessage.DATA_DELETED);
  } catch (error) {
    console.error("Error deleting advertisement:", error);
    return JsonRes.serverError(res, error, ResponseMessage.SERVER_ERROR);
  }
};

// Approve Advertisement...
export const approveAdvertisement = async (req, res) => {
  try {
    const { id } = req.params;

    const ad = await Advertisement.findById(id);
    if (!ad) return JsonRes.notFound(res, null, "Advertisement not found.");

    ad.status = "approved";
    ad.rejectionReason = null; 
    await ad.save();

    return JsonRes.success(res, ad, "Advertisement approved successfully.");
  } catch (error) {
    console.error("Error approving ad:", error);
    return JsonRes.serverError(res, error, ResponseMessage.SERVER_ERROR);
  }
};

// Reject Advertisement...
export const rejectAdvertisement = async (req, res) => {
  try {
    const { id } = req.params
    const { reason } = req.body

    const ad = await Advertisement.findById(id)
    if (!ad) return JsonRes.notFound(res, null, "Advertisement not found.")

    ad.status = "rejected"
    ad.rejectionReason = reason
    await ad.save()

    return JsonRes.success(res, ad, "Advertisement rejected successfully.")
  } catch (error) {
    console.error("Error rejecting ad:", error)
    return JsonRes.serverError(res, error, ResponseMessage.SERVER_ERROR)
  }
}

