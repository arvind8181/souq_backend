import JsonRes from "../../helpers/response.js";
import User from "../../models/user/user.js";
import DriverDetail from "../../models/driverDetails/driverDetails.js";
import jwt from "jsonwebtoken";
import {
  uploadImage,
  getPresignedImageUrls,
} from "../../services/s3Service.js";
import { S3TYPE } from "../../utils/constant.js";
import { sendMail } from "../../helpers/mail.js";
import { updateDriverLocation as socketUpdateDriverLocation } from "../../helpers/socket.js";
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRY || "1d",
  });
};

const {
  badRequest,
  conflict,
  success,
  serverError,
  failed,
  dataCreated,
  unauthorized,
} = JsonRes;

export const driverDocUpload = async (req, res) => {
  try {
    /*──────────────────── Auth check ────────────────────*/
    const userId = req.user?._id || req.user?.id;
    if (!userId) return unauthorized(res, null, "Not authenticated");

    /*──────────────────── Files from middleware ────────────────────*/
    const {
      idCardFront: [idCardFront],
      idCardBack: [idCardBack],
      drivingLicenseFront: [drivingLicenseFront],
      drivingLicenseBack: [drivingLicenseBack],
    } = req.compressedFiles || {};

    if (
      !idCardFront ||
      !idCardBack ||
      !drivingLicenseFront ||
      !drivingLicenseBack
    ) {
      return badRequest(
        res,
        null,
        "idCardFront, idCardBack, drivingLicenseFront,mobile number , vehicleType, driverType and drivingLicenseBack are all required."
      );
    }

    /*──────────────────── Extra fields from req.body ────────────────────*/
    const { vehicleType, driverType, mobileNumber } = req.body;

    // Validate enums if you want extra safety
    const validVehicleTypes = ["bike", "van"];
    const validDriverTypes = ["full-time", "part-time"];

    if (vehicleType && !validVehicleTypes.includes(vehicleType)) {
      return badRequest(res, null, "Invalid vehicleType provided.");
    }
    if (driverType && !validDriverTypes.includes(driverType)) {
      return badRequest(res, null, "Invalid driverType provided.");
    }

    /*──────────────────── Build S3 keys ────────────────────*/
    const folder = `${S3TYPE.DRIVER}/${userId}`;
    const keys = {
      idCardFront: `${folder}/idCardFront.jpg`,
      idCardBack: `${folder}/idCardBack.jpg`,
      drivingLicenseFront: `${folder}/drivingLicenseFront.jpg`,
      drivingLicenseBack: `${folder}/drivingLicenseBack.jpg`,
    };

    /*──────────────────── Upload to S3 ────────────────────*/
    await Promise.all([
      uploadImage({
        buffer: idCardFront.buffer,
        s3Name: keys.idCardFront,
      }),
      uploadImage({
        buffer: idCardBack.buffer,
        s3Name: keys.idCardBack,
      }),
      uploadImage({
        buffer: drivingLicenseFront.buffer,
        s3Name: keys.drivingLicenseFront,
      }),
      uploadImage({
        buffer: drivingLicenseBack.buffer,
        s3Name: keys.drivingLicenseBack,
      }),
    ]);

    /*──────────────────── Update DriverDetail ────────────────────*/
    await DriverDetail.updateOne(
      { userId },
      {
        idCardFrontUrl: keys.idCardFront,
        idCardBackUrl: keys.idCardBack,
        drivingLicenseFrontUrl: keys.drivingLicenseFront,
        drivingLicenseBackUrl: keys.drivingLicenseBack,
        profileComplete: true,
        ...(vehicleType && { vehicleType }),
        ...(driverType && { driverType }),
        ...(mobileNumber && { mobileNumber }),
      },
      { upsert: true }
    );

    return success(res, null, "Driver documents uploaded.");
  } catch (err) {
    console.error("driverDocUpload error:", err);
    return serverError(res, err, "Failed to upload driver documents.");
  }
};

export const getPendingDrivers = async (req, res) => {
  try {
    const pendingDrivers = await DriverDetail.find({
      status: "Pending",
      profileComplete: true,
    }).populate({
      path: "userId",
      select: "email", // Only include email from User
      model: User,
    });

    await Promise.all(
      pendingDrivers.map(async (driver) => {
        if (driver.idCardFrontUrl) {
          const [idCardFrontUrl] = await getPresignedImageUrls([
            driver.idCardFrontUrl,
          ]);
          driver.idCardFrontUrl = idCardFrontUrl;
        }
        if (driver.idCardBackUrl) {
          const [idCardBackUrl] = await getPresignedImageUrls([
            driver.idCardBackUrl,
          ]);
          driver.idCardBackUrl = idCardBackUrl;
        }
        if (driver.drivingLicenseFrontUrl) {
          const [drivingLicenseFrontUrl] = await getPresignedImageUrls([
            driver.drivingLicenseFrontUrl,
          ]);
          driver.drivingLicenseFrontUrl = drivingLicenseFrontUrl;
        }
        if (driver.drivingLicenseBackUrl) {
          const [drivingLicenseBackUrl] = await getPresignedImageUrls([
            driver.drivingLicenseBackUrl,
          ]);
          driver.drivingLicenseBackUrl = drivingLicenseBackUrl;
        }
      })
    );

    return success(
      res,
      pendingDrivers,
      "Fetched all pending driver successfully."
    );
  } catch (error) {
    console.error("Error fetching pending drivers:", error);
    return serverError(res, error, "Failed to fetch pending drivers.");
  }
};

export const updateDriverStatus = async (req, res) => {
  const { driverId, status, deleted } = req.body;

  try {
    if (!driverId) {
      return badRequest(res, null, "Driver ID is required.");
    }

    // Fetch driver and user
    const driver = await DriverDetail.findById(driverId).populate({
      path: "userId",
      select: "email",
      model: User,
    });

    if (!driver) {
      return notFound(res, null, "Driver not found with the given ID.");
    }

    const user = driver.userId;
    if (!user) {
      return notFound(res, null, "Driver's user account not found.");
    }

    // ----- ✅ Handle status update (only if status is provided) -----
    if (status !== undefined) {
      const allowedStatuses = ["Approved", "Rejected"];
      if (!allowedStatuses.includes(status)) {
        return badRequest(
          res,
          null,
          "Invalid status value. Use 'Approved' or 'Rejected'."
        );
      }

      driver.status = status;
      await driver.save();

      // ✉️ Send status email
      const emailSubject =
        status === "Approved"
          ? "Driver Account Approved"
          : "Driver Account Rejected";

      const emailBody =
        status === "Approved"
          ? `<p>Congratulations! Your driver account has been <strong>approved</strong>.</p>
             <p>You can now log in and start accepting ride or delivery requests on our platform.</p>`
          : `<p>Unfortunately, your driver account has been <strong>rejected</strong>.</p>
             <p>If you believe this is a mistake or want more details, feel free to contact support.</p>`;

      await sendMail({
        to: user.email,
        subject: emailSubject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <div style="background: #2196F3; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h2 style="color: white; margin: 0;">Driver Status Update</h2>
            </div>
            <div style="padding: 20px; background: #f9f9f9; border-radius: 0 0 8px 8px;">
              <p>Hello ${user.name || ""},</p>
              ${emailBody}
              <p style="margin-top: 30px;">Best regards,<br>Your Company Team</p>
            </div>
          </div>
        `,
      });
    }

    // ----- ✅ Handle delete/reactivate (only if deleted is boolean) -----
    if (typeof deleted === "boolean") {
      user.deleted = deleted;
      await user.save();

      const emailSubject = deleted
        ? "Driver Account Deactivated"
        : "Driver Account Reactivated";

      const emailBody = deleted
        ? `<p>Your driver account has been <strong>deactivated</strong>.</p>
           <p>If you have questions or believe this was a mistake, please contact support.</p>`
        : `<p>Your driver account has been <strong>re-activated</strong>.</p>
           <p>You may now access your account and continue using the platform.</p>`;

      await sendMail({
        to: user.email,
        subject: emailSubject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <div style="background: #FF9800; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h2 style="color: white; margin: 0;">Driver Account ${
                deleted ? "Deactivated" : "Reactivated"
              }</h2>
            </div>
            <div style="padding: 20px; background: #f9f9f9; border-radius: 0 0 8px 8px;">
              <p>Hello ${user.name || ""},</p>
              ${emailBody}
              <p style="margin-top: 30px;">Best regards,<br>Your Company Team</p>
            </div>
          </div>
        `,
      });

      return success(
        res,
        { userId: user._id, deleted: user.deleted },
        `Driver account has been ${
          deleted ? "deactivated" : "reactivated"
        } successfully.`
      );
    }

    return success(
      res,
      driver,
      status
        ? `Driver status updated to '${status}' successfully.`
        : "No changes made."
    );
  } catch (error) {
    console.error("Error updating driver status or deletion:", error);
    return serverError(
      res,
      error,
      "Failed to update driver status or account deletion."
    );
  }
};

// get driverDoc ....
export const getDriverDoc = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("userId:", userId);

    const driver = await DriverDetail.findOne({ userId: userId });

    if (!driver) {
      return badRequest(res, null, "Driver documents not found for this user.");
    }

    const plainDriver = driver.toObject();

    //  Collect all image keys into an array
    const imageKeys = [
      plainDriver.drivingLicenseBackUrl,
      plainDriver.drivingLicenseFrontUrl,
      plainDriver.idCardBackUrl,
      plainDriver.idCardFrontUrl,
    ].filter(Boolean);

    //  Get presigned URLs
    const presignedUrls = await getPresignedImageUrls(imageKeys);

    // Replace original keys with presigned URLs
    if (plainDriver.drivingLicenseBackUrl) {
      plainDriver.drivingLicenseBackUrl = presignedUrls[0];
    }
    if (plainDriver.drivingLicenseFrontUrl) {
      plainDriver.drivingLicenseFrontUrl = presignedUrls[1];
    }
    if (plainDriver.idCardBackUrl) {
      plainDriver.idCardBackUrl = presignedUrls[2];
    }
    if (plainDriver.idCardFrontUrl) {
      plainDriver.idCardFrontUrl = presignedUrls[3];
    }

    return success(res, plainDriver, "Driver documents fetched successfully.");
  } catch (err) {
    console.error("getDriverDoc error:", err);
    return serverError(res, err, "Failed to fetch driver documents.");
  }
};

// update driverDoc...
export const updateDriverDoc = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return unauthorized(res, null, "Not authenticated");

    //  Files from middleware
    const {
      idCardFront: [idCardFront] = [],
      idCardBack: [idCardBack] = [],
      drivingLicenseFront: [drivingLicenseFront] = [],
      drivingLicenseBack: [drivingLicenseBack] = [],
    } = req.compressedFiles || {};

    //  At least one file must be provided
    if (
      !idCardFront &&
      !idCardBack &&
      !drivingLicenseFront &&
      !drivingLicenseBack
    ) {
      return badRequest(
        res,
        null,
        "At least one of idCardFront, idCardBack, drivingLicenseFront, or drivingLicenseBack must be provided."
      );
    }

    //  Build S3 folder path
    const folder = `${S3TYPE.DRIVER}/${userId}`;
    const updates = {};

    //  Upload and update only provided files
    if (idCardFront) {
      const key = `${folder}/idCardFront.jpg`;
      await uploadImage({ buffer: idCardFront.buffer, s3Name: key });
      updates.idCardFrontUrl = key;
    }
    if (idCardBack) {
      const key = `${folder}/idCardBack.jpg`;
      await uploadImage({ buffer: idCardBack.buffer, s3Name: key });
      updates.idCardBackUrl = key;
    }
    if (drivingLicenseFront) {
      const key = `${folder}/drivingLicenseFront.jpg`;
      await uploadImage({ buffer: drivingLicenseFront.buffer, s3Name: key });
      updates.drivingLicenseFrontUrl = key;
    }
    if (drivingLicenseBack) {
      const key = `${folder}/drivingLicenseBack.jpg`;
      await uploadImage({ buffer: drivingLicenseBack.buffer, s3Name: key });
      updates.drivingLicenseBackUrl = key;
    }

    updates.updatedAt = new Date();

    //  Update DriverDetail in DB
    await DriverDetail.updateOne({ userId }, updates, { upsert: false });

    //  Fetch updated driver document
    const driver = await DriverDetail.findOne({ userId });
    if (!driver) {
      return badRequest(res, null, "Failed to fetch updated driver documents.");
    }

    const plainDriver = driver.toObject();

    //  Get presigned URLs for all images
    const imageKeys = [
      plainDriver.drivingLicenseBackUrl,
      plainDriver.drivingLicenseFrontUrl,
      plainDriver.idCardBackUrl,
      plainDriver.idCardFrontUrl,
    ].filter(Boolean);

    const presignedUrls = await getPresignedImageUrls(imageKeys);

    if (plainDriver.drivingLicenseBackUrl) {
      plainDriver.drivingLicenseBackUrl = presignedUrls[0];
    }
    if (plainDriver.drivingLicenseFrontUrl) {
      plainDriver.drivingLicenseFrontUrl = presignedUrls[1];
    }
    if (plainDriver.idCardBackUrl) {
      plainDriver.idCardBackUrl = presignedUrls[2];
    }
    if (plainDriver.idCardFrontUrl) {
      plainDriver.idCardFrontUrl = presignedUrls[3];
    }

    return success(res, plainDriver, "Driver documents updated successfully.");
  } catch (err) {
    console.error("updateDriverDoc error:", err);
    return serverError(res, err, "Failed to update driver documents.");
  }
};
export const getAllDrivers = async (req, res) => {
  try {
    const userId = req.user.id;

    // Extract query params
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

    // Build aggregation pipeline
    const pipeline = [
      {
        $match: { profileComplete: true },
      },
      {
        $lookup: {
          from: "users", // Mongo collection for User
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: "$user",
      },
    ];

    // 🔍 Apply search filter on user.email if provided
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { "user.email": { $regex: search, $options: "i" } },
            { FullName: { $regex: search, $options: "i" } },
          ],
        },
      });
    }

    // For total count (with same filters applied)
    const countPipeline = [...pipeline, { $count: "total" }];
    const countResult = await DriverDetail.aggregate(countPipeline);
    const totalRecords = countResult.length > 0 ? countResult[0].total : 0;

    // Sorting + pagination + projection
    pipeline.push(
      { $sort: { [sortKey]: sortOrder } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          profileComplete: 1,
          FullName: 1,
          status: 1,
          vehicleType: 1,
          createdAt: 1,
          drivingLicenseBackUrl: 1,
          drivingLicenseFrontUrl: 1,
          idCardBackUrl: 1,
          idCardFrontUrl: 1,
          "user.email": 1,
          "user.deleted": 1,
        },
      }
    );

    const drivers = await DriverDetail.aggregate(pipeline);

    // Step 1: Gather all image keys
    const allImageKeys = [];
    drivers.forEach((driver) => {
      if (driver.drivingLicenseBackUrl)
        allImageKeys.push(driver.drivingLicenseBackUrl);
      if (driver.drivingLicenseFrontUrl)
        allImageKeys.push(driver.drivingLicenseFrontUrl);
      if (driver.idCardBackUrl) allImageKeys.push(driver.idCardBackUrl);
      if (driver.idCardFrontUrl) allImageKeys.push(driver.idCardFrontUrl);
    });

    // Step 2: Get all presigned URLs
    const presignedUrls = await getPresignedImageUrls(allImageKeys);

    // Step 3: Replace image keys with presigned URLs
    let urlIndex = 0;
    const updatedDrivers = drivers.map((driver) => {
      if (driver.drivingLicenseBackUrl) {
        driver.drivingLicenseBackUrl = presignedUrls[urlIndex++];
      }
      if (driver.drivingLicenseFrontUrl) {
        driver.drivingLicenseFrontUrl = presignedUrls[urlIndex++];
      }
      if (driver.idCardBackUrl) {
        driver.idCardBackUrl = presignedUrls[urlIndex++];
      }
      if (driver.idCardFrontUrl) {
        driver.idCardFrontUrl = presignedUrls[urlIndex++];
      }
      return driver;
    });

    return success(
      res,
      {
        data: updatedDrivers,
        totalRecords,
        currentPage: pageNum,
        pageSize: limit,
      },
      "Drivers retrieved successfully."
    );
  } catch (error) {
    console.error("Error retrieving drivers:", error);
    return serverError(res, error, "Failed to retrieve drivers.");
  }
};

// toggle driver availability
export const toggleDriverAvailability = async (req, res) => {
  try {
    const driverUserId = req.user?.id; // Driver ID from token
    if (!driverUserId)
      return badRequest(res, null, "Unauthorized: Driver ID not found.");

    // Find the driver
    const driver = await DriverDetail.findOne({ userId: driverUserId });
    if (!driver) return notFound(res, null, "Driver not found.");

    // Toggle availability
    driver.isAvailable = !driver.isAvailable;

    await driver.save();

    return success(
      res,
      { isAvailable: driver.isAvailable },
      `Driver is now ${driver.isAvailable ? "available" : "unavailable"}.`
    );
  } catch (err) {
    console.error("Error toggling driver availability:", err);
    return serverError(res, err, "Failed to toggle driver availability.");
  }
};

export const updateDriverLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const driverId = req.user.id; // comes from verifyDriver middleware

    await socketUpdateDriverLocation(
      req.headers.authorization.split(" ")[1],
      latitude,
      longitude
    );

    return success(
      res,
      { driverId, latitude, longitude },
      "Driver location updated."
    );
  } catch (err) {
    console.error("Error updating driver location:", err);
    return serverError(res, err, "Failed to update driver location.");
  }
};


