import { hash } from "bcryptjs";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import JsonRes from "../../helpers/response.js";
import User from "../../models/user/user.js";
import VendorDetail from "../../models/vendorDetails/vendorDetails.js";
import CustomerDetail from "../../models/customerDetails/customerDetails.js";
import DriverDetail from "../../models/driverDetails/driverDetails.js";
import Notification from "../../models/notification/notification.js";
import jwt from "jsonwebtoken";
import { ROLES } from "../../utils/constant.js";
import crypto from "crypto";
import { COLORS } from "../../utils/constant.js";
import axios from "axios";
import {
  uploadImage,
  getPresignedImageUrls,
} from "../../services/s3Service.js";
import { S3TYPE } from "../../utils/constant.js";
import mime from "mime-types";
import { sendMail } from "../../helpers/mail.js";
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

export const markAsRead = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded._id || decoded.id;

    // ✅ Update all notifications for this user
    const result = await Notification.updateMany(
      { userId, isRead: false }, // only unread
      { $set: { isRead: true } }
    );

    return success(res, result, "All notifications marked as read.");
  } catch (err) {
    console.error("markAsRead error:", err);
    return serverError(res, err, "Failed to mark notifications as read.");
  }
};
