// helpers/socket.js
import jwt from "jsonwebtoken";
import DriverDetail from "../models/driverDetails/driverDetails.js";
import { ROLES } from "../utils/constant.js";
import User from "../models/user/user.js";
import Message from "../models/message/message.js";
import Notification from "../models/notification/notification.js";
import Order from "../models/order/order.js";
import { markAsRead } from "../helpers/notifcation.js";
import { getPresignedImageUrls } from "../services/s3Service.js";

const green = "\x1b[32m";
const reset = "\x1b[0m";
const red = "\x1b[31m";
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

/**
 * Verifies token and updates driver's location
 * @param {string} token - JWT token from driver
 * @param {number} latitude
 * @param {number} longitude
 */
export const updateDriverLocation = async (token, latitude, longitude) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.role !== ROLES.DRIVER) {
      console.log(`${red}Access denied: Not a driver.${reset}`);
      return;
    }

    const driverId = decoded._id || decoded.id;

    await DriverDetail.findOneAndUpdate(
      { userId: driverId },
      {
        $set: {
          location: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
        },
      },
      { new: true }
    );

    console.log(`${green}Updated location for driver:${reset} ${driverId}`);
  } catch (err) {
    console.error(
      `${red}Error verifying token or updating location:${reset}`,
      err
    );
  }
};

export const sendSocketMessage = async (
  { chatId, senderId, receiverId, message },
  io
) => {
  try {
    if (senderId === "admin" || receiverId === "admin") {
      const adminUser = await User.findOne({ role: 10 });
      if (!adminUser) {
        console.error("Admin user not found.");
        return;
      }
      if (senderId === "admin") senderId = adminUser._id.toString();
      if (receiverId === "admin") receiverId = adminUser._id.toString();
    }

    const newMsg = await Message.create({
      chatId,
      senderId,
      receiverId,
      message,
    });

    io.to(chatId).emit("newMessage", newMsg);
  } catch (err) {
    console.error("Error sending socket message:", err);
  }
};

export const getNotification = async (payload, io) => {
  try {
    const { userId } = payload;

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    io.to(userId.toString()).emit("notificationList", notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
  }
};

export const handleMarkAsRead = async (payload, io) => {
  try {
    const { notificationIds, userId } = payload;

    await markAsRead(notificationIds, userId);

    // Optionally, re-fetch updated list and send
    const updatedList = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .lean();
    io.to(userId.toString()).emit("notificationList", updatedList);
  } catch (error) {
    console.error("Error marking notifications as read:", error);
  }
};

export const handleGetDriverLocation = async (socket, { driverId }) => {
  try {
    if (!driverId) {
      return socket.emit("driverLocationResponse", {
        success: false,
        message: "driverId is required",
      });
    }

    const driver = await DriverDetail.findById(driverId).select(
      "location FullName mobileNumber profileImage"
    );

    if (!driver) {
      return socket.emit("driverLocationResponse", {
        success: false,
        message: "Driver not found",
      });
    }

    // Generate presigned URL for profileImage (if exists)
    if (driver.profileImage) {
      const [profileImageUrl] = await getPresignedImageUrls([
        driver.profileImage,
      ]);
      driver.profileImage = profileImageUrl;
    }

    socket.emit("driverLocationResponse", {
      success: true,
      driverId,
      location: driver.location,
      FullName: driver.FullName,
      mobileNumber: driver.mobileNumber,
      profileImage: driver.profileImage || null,
    });
  } catch (error) {
    console.error("Error fetching driver location:", error);
    socket.emit("driverLocationResponse", {
      success: false,
      message: "Failed to fetch driver location",
    });
  }
};

export const handleGetVendorOrderDetails = async (
  socket,
  { orderId, vendorId }
) => {
  try {
    if (!orderId || !vendorId) {
      return socket.emit("vendorOrderDetailsResponse", {
        success: false,
        message: "orderId and vendorId are required",
      });
    }

    // 🔹 Find order
    const order = await Order.findById(orderId)
      .populate("customerId", "name email mobileNumber")
      .populate("vendors.vendorId", "name email")
      .populate("vendors.driverId", "FullName mobileNumber")
      .populate("vendors.items.productId", "productName price images")
      .lean();

    if (!order) {
      return socket.emit("vendorOrderDetailsResponse", {
        success: false,
        message: "Order not found",
      });
    }

    // 🔹 Extract vendor block
    const vendorBlock = order.vendors.find(
      (v) => v.vendorId?._id?.toString() === vendorId.toString()
    );

    if (!vendorBlock) {
      return socket.emit("vendorOrderDetailsResponse", {
        success: false,
        message: "Vendor not found in this order",
      });
    }

    // 🔹 Build response
    const vendorOrderDetails = {
      orderId: order._id,
      orderNumber: order.orderNumber,
      // customer: order.customerId,
      // dropStreet: order.dropStreet,
      // dropCity: order.dropCity,
      // dropState: order.dropState,
      // dropCountry: order.dropCountry,
      // notes: order.notes,
      // totalItems: order.totalItems,
      // subTotal: order.subTotal,
      // shippingFee: order.shippingFee,
      // grandTotal: order.grandTotal,
      // paymentMethod: order.paymentMethod,
      // paymentStatus: order.paymentStatus,
      // type: order.type,
      // createdAt: order.createdAt,

      // vendor-specific fields
      vendor: vendorBlock.vendorId,
      status: vendorBlock.status,
      driver: vendorBlock.driverId,
      // items: vendorBlock.items,
      // pickupStreet: vendorBlock.pickupStreet,
      // pickupCity: vendorBlock.pickupCity,
      // pickupState: vendorBlock.pickupState,
      // pickupCountry: vendorBlock.pickupCountry,
    };

    return socket.emit("vendorOrderDetailsResponse", {
      success: true,
      data: vendorOrderDetails,
    });
  } catch (error) {
    console.error("Error fetching vendor order details:", error);
    return socket.emit("vendorOrderDetailsResponse", {
      success: false,
      message: "Failed to fetch vendor order details",
    });
  }
};
// In your backend socket handler
export const handleGetActiveDeliveringDrivers = async (socket) => {
  try {
    const drivers = await DriverDetail.find({
      isDelivering: true,
      status: "Approved",
    })
      .select(
        "FullName mobileNumber profileImage drivingLicenseFrontUrl drivingLicenseBackUrl vehicleType driverType status isDelivering isAvailable location" // ✅ Add location
      )
      .populate("userId", "email"); // ✅ Populate user data if needed

    console.log("Active delivering drivers found:", drivers.length);

    if (!drivers || drivers.length === 0) {
      return socket.emit("activeDriversResponse", {
        success: true,
        drivers: [],
        message: "No active delivering drivers found",
      });
    }

    // ... rest of your image processing code ...

    const driverData = drivers.map((driver) => {
      const d = driver.toObject();
      // ... your image URL mapping ...

      return {
        _id: d._id, // ✅ Add _id for the click handler
        driverId: d._id,
        FullName: d.FullName,
        mobileNumber: d.mobileNumber,
        profileImage: d.profileImage,
        drivingLicenseFrontUrl: d.drivingLicenseFrontUrl,
        drivingLicenseBackUrl: d.drivingLicenseBackUrl,
        vehicleType: d.vehicleType,
        driverType: d.driverType,
        status: d.status,
        isDelivering: d.isDelivering,
        isAvailable: d.isAvailable,
        location: d.location, // ✅ Include location data
        user: { email: d.userId?.email }, // ✅ Include user data if needed
      };
    });

    socket.emit("activeDriversResponse", {
      success: true,
      drivers: driverData,
      message: "Active delivering drivers retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching active delivering drivers:", error);
    socket.emit("activeDriversResponse", {
      success: false,
      message: "Failed to fetch active delivering drivers",
    });
  }
};
