// utils/generateAndSendOtp.js
import jwt from "jsonwebtoken";
import { sendMail } from "../helpers/mail.js";
import { COLORS } from "../utils/constant.js";

export const generateAndSendOtp = async (user, subject = "Your OTP Code") => {
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const token = jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      verified: false,
      expiresIn: otpExpiresAt,
    },
    process.env.JWT_SECRET
  );

  const html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: ${COLORS.TEXT_DARK};">
    <div style="background: ${COLORS.PRIMARY}; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <h2 style="color: ${COLORS.WHITE}; margin: 0;">Verify Your Account</h2>
    </div>
    <div style="padding: 20px; background: ${COLORS.BACKGROUND_LIGHT}; border-radius: 0 0 8px 8px;">
      <p>Hello,</p>
      <p>Use the following OTP to verify your account: <strong>${otpCode}</strong>. This OTP will be valid for 10 minutes.</p>
      <p>If you didn't request this, please ignore this email.</p>
      <p style="margin-top: 30px;">Best regards,<br>Dual MarketPlace Team</p>
    </div>
  </div>`;

  await sendMail({
    to: user.email,
    subject,
    html,
  });

  return { otpCode, otpExpiresAt, token };
};
