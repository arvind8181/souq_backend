import admin from "firebase-admin";
import User from "../models/user/user.js";
import CustomerDetail from "../models/customerDetails/customerDetails.js";
import DriverDetail from "../models/driverDetails/driverDetails.js";
import VendorDetail from "../models/vendorDetails/vendorDetails.js";
import Notification from "../models/notifications/notifications.js";
import { ROLES } from "../utils/constant.js";

import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Service accounts ---
const customerVendorServiceAccount = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../fcm/fcmServiceAccountKey.json"), "utf8")
);
const driverServiceAccount = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../fcm/driverFcm.json"), "utf8")
);

// --- Initialize Firebase apps separately ---
let customerApp, driverApp;

if (!admin.apps.find((app) => app.name === "customerApp")) {
  customerApp = admin.initializeApp(
    { credential: admin.credential.cert(customerVendorServiceAccount) },
    "customerApp"
  );
} else {
  customerApp = admin.app("customerApp");
}

if (!admin.apps.find((app) => app.name === "driverApp")) {
  driverApp = admin.initializeApp(
    { credential: admin.credential.cert(driverServiceAccount) },
    "driverApp"
  );
} else {
  driverApp = admin.app("driverApp");
}

/**
 * Send push notification + save to DB
 *
 * @param {Object} options
 * @param {String} options.entityId - _id of driver/vendor/customer detail OR userId for admin
 * @param {String} options.title - Notification title
 * @param {String} options.body - Notification body
 * @param {Object} [options.data] - Optional custom data
 */
export const sendNotification = async ({ entityId, title, body, data = {} }) => {
  let notificationDoc = null;
  try {
    console.log("🔔 Sending notification:", { entityId, title, body, data });

    // --- Get User ---
    let user = await User.findById(entityId); // if Admin (userId directly)
    let role = user?.role;

    if (!user) {
      let detail = await DriverDetail.findById(entityId);
      if (detail) {
        user = await User.findById(detail.userId);
        role = ROLES.DRIVER;
      }

      if (!detail) {
        detail = await VendorDetail.findById(entityId);
        if (detail) {
          user = await User.findById(detail.userId);
          role = ROLES.VENDOR;
        }
      }

      if (!detail) {
        detail = await CustomerDetail.findById(entityId);
        if (detail) {
          user = await User.findById(detail.userId);
          role = ROLES.CUSTOMER;
        }
      }
    }

    if (user.notificationsEnabled === false) {
      console.log(`🔕 Notifications disabled for user: ${user.email}`);
      return;
    }

    if (!user || !user.loginToken?.deviceToken) {
      console.log("❌ No device token found for entityId:", entityId);
      return;
    }

    const { deviceToken, deviceType } = user.loginToken;

    // 🔑 Convert all data values to strings
    const stringifiedData = {};
    Object.keys(data).forEach((key) => {
      stringifiedData[key] = String(data[key]);
    });

    const message = {
      token: deviceToken,
      notification: { title, body },
      data: { ...stringifiedData, title: String(title), body: String(body) },
      apns:
        deviceType === "ios"
          ? {
            payload: {
              aps: {
                alert: { title, body },
                sound: "default",
              },
            },
          }
          : undefined,
      android:
        deviceType === "android"
          ? {
            notification: { sound: "default" },
          }
          : undefined,
    };

    // --- Choose correct Firebase app ---
    let fcmApp;
    if (role === ROLES.DRIVER) {
      fcmApp = driverApp;
    } else if (role === ROLES.CUSTOMER || role === ROLES.VENDOR) {
      fcmApp = customerApp;
    } else if (role === ROLES.ADMIN) {
      console.log("ℹ️ Skipping notification for ADMIN role");
      return;
    } else {
      fcmApp = customerApp;
    }

    // --- Save notification first (status = "pending") ---
    notificationDoc = await Notification.create({
      userId: user._id,
      role,
      title,
      body,
      data,
      deviceToken,
      deviceType,
      status: "pending",
    });

    // --- Send notification ---
    const response = await fcmApp.messaging().send(message);
    console.log("✅ Notification sent successfully:", response);

    // --- Update status to sent ---
    await Notification.findByIdAndUpdate(notificationDoc._id, { status: "sent" });
  } catch (error) {
    console.error("❌ Failed to send push notification:", error);

    if (notificationDoc) {
      await Notification.findByIdAndUpdate(notificationDoc._id, { status: "failed" });
    }
  }
};
