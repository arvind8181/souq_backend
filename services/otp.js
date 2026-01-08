// services/authService.js
import jwt from "jsonwebtoken";
import User from "../models/user/user.js";

export const verifyOtpAndGetUser = async (otp, token) => {
  if (!otp || !token) {
    throw { status: 400, message: "OTP and token are required." };
  }

  let decoded;
  try {
    // Ignore expiration when decoding
    decoded = jwt.verify(token, process.env.JWT_SECRET, {
      ignoreExpiration: true,
    });
  } catch (err) {
    throw { status: 401, message: "Invalid token." };
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    throw { status: 401, message: "User not found." };
  }

  if (
    !user.otp ||
    user.otp.code !== otp ||
    new Date(user.otp.expiresAt) < new Date()
  ) {
    throw { status: 401, message: "OTP is invalid or has expired." };
  }

  return user;
};
