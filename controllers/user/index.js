import { hash, compare } from "bcryptjs";
import bcrypt from "bcrypt";
import JsonRes from "../../helpers/response.js";
import User from "../../models/user/user.js";
import VendorDetail from "../../models/vendorDetails/vendorDetails.js";
import CustomerDetail from "../../models/customerDetails/customerDetails.js";
import DriverDetail from "../../models/driverDetails/driverDetails.js";
import Testing from "../../models/testing/testing.js";
import jwt from "jsonwebtoken";
import { ROLES, S3TYPE, COLORS } from "../../utils/constant.js";
import { sendMail } from "../../helpers/mail.js";
import { generateAndSendOtp } from "../../services/generateAndSendOtp.js";
import { verifyOtpAndGetUser } from "../../services/otp.js";
import Notification from "../../models/notifications/notifications.js";
import axios from "axios";
import {
  uploadImage,
  deleteObject,
  getPresignedImageUrls,
} from "../../services/s3Service.js";
import { sendNotification } from "../../services/notificationService.js";
import SubAdminPermission from "../../models/subadminpermission/SubAdminPermission.js";
import { PERMISSIONS } from "../../utils/constant.js";
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
  notFound,
} = JsonRes;

export const createAccount = async (req, res) => {
  try {
    const {
      email,
      password,
      role,
      fullName = "",
      createdByAdmin = false,
      permissions = [],
    } = req.body;

    /* 1 Basic validation */
    if (!email || !password || role == null) {
      return badRequest(res, null, "Email, password and role are required.");
    }
    if (!Object.values(ROLES).includes(Number(role))) {
      return badRequest(res, null, "Invalid role specified.");
    }
    const roleNumber = Number(role);
    if (
      createdByAdmin &&
      (req.user?.role !== ROLES.ADMIN || roleNumber !== ROLES.SUB_ADMIN)
    ) {
      return unauthorized(
        res,
        null,
        "createdByAdmin is only allowed for sub-admin creation by admin",
      );
    }
    if (createdByAdmin && roleNumber === ROLES.SUB_ADMIN) {
      const invalidPermissions = permissions.filter(
        (p) => !Object.values(PERMISSIONS).includes(p),
      );

      if (invalidPermissions.length > 0) {
        return badRequest(
          res,
          null,
          `Invalid permissions: ${invalidPermissions.join(", ")}`,
        );
      }
    }
    // Convert role to number after validation

    console.log(" DEBUG - Input values:", { email, roleNumber, fullName });

    /* 2 Look for an existing user with same email & role */
    let user = await User.findOne({ email, role: roleNumber });
    console.log(" DEBUG - Existing user found:", user ? "YES" : "NO");

    /* ─────────────────────────────────────────────────────────── */
    /* CASE A: verified user already exists  → 409 Conflict        */
    /* ─────────────────────────────────────────────────────────── */
    if (user && user.verified) {
      console.log(" DEBUG - Path: CASE A (verified user exists)");
      return conflict(res, null, "User already exists.");
    }

    /* Prepare the hashed pwd once (used in both CASE B and CASE C) */
    const hashedPassword = await hash(password, 10);

    /* ─────────────────────────────────────────────────────────── */
    /* CASE B: user exists but is NOT verified  → override fields  */
    /* ─────────────────────────────────────────────────────────── */
    if (user && !user.verified) {
      console.log(" DEBUG - Path: CASE B (unverified user exists)");

      user.password = hashedPassword;
      user.deleted = false;
      await user.save();

      // ── Update name in side‑document (only customer/driver) ──
      console.log("DEBUG - Switch values:", {
        roleNumber,
        ROLES_CUSTOMER: ROLES.CUSTOMER,
      });

      switch (roleNumber) {
        case ROLES.CUSTOMER:
          console.log(" DEBUG - Executing CUSTOMER case in CASE B");
          try {
            const result = await CustomerDetail.findOneAndUpdate(
              { userId: user._id },
              { FullName: fullName },
              { new: true },
            );
            console.log(" DEBUG - CustomerDetail update result:", result);
            if (!result) {
              console.log(
                " DEBUG - No CustomerDetail found to update, creating new one...",
              );
              const newCustomer = await CustomerDetail.create({
                userId: user._id,
                FullName: fullName,
              });
              console.log(" DEBUG - New CustomerDetail created:", newCustomer);
            }
          } catch (error) {
            console.error(" DEBUG - CustomerDetail update error:", error);
          }
          break;
        case ROLES.DRIVER:
          console.log(" DEBUG - Executing DRIVER case in CASE B");
          try {
            const result = await DriverDetail.findOneAndUpdate(
              { userId: user._id },
              { FullName: fullName },
              { new: true },
            );
            console.log(" DEBUG - DriverDetail update result:", result);
          } catch (error) {
            console.error(" DEBUG - DriverDetail update error:", error);
          }
          break;
        default:
          console.log(" DEBUG - No case matched in CASE B switch");
      }

      // regenerate OTP
      // const { otpCode, otpExpiresAt, token } = await generateAndSendOtp(user);
      // user.otp = { code: otpCode, expiresAt: otpExpiresAt };
      // await user.save();
      // return success(res, { token }, "Account updated. OTP sent to email.");
      if (createdByAdmin && roleNumber === ROLES.SUB_ADMIN) {
        user.fullName = fullName; // ✅ ADD THIS
        await user.save();
        const permissionDoc = await SubAdminPermission.findOneAndUpdate(
          { userId: user._id },
          { permissions },
          { new: true, upsert: true },
        );
        return success(
          res,
          {
            user: {
              _id: user._id,
              email: user.email,
              fullName: user.fullName,
              role: user.role,
              verified: user.verified,
            },
            permissions: permissionDoc?.permissions || [],
            availablePermissions: Object.values(PERMISSIONS),
          },
          "Sub-admin account updated successfully.",
        );
      }

      // 📨 Normal flow → OTP required
      const { otpCode, otpExpiresAt, token } = await generateAndSendOtp(user);
      user.otp = { code: otpCode, expiresAt: otpExpiresAt };
      await user.save();

      return success(res, { token }, "Account updated. OTP sent to email.");
    }

    /* ─────────────────────────────────────────────────────────── */
    /* CASE C: no user at all  → create brand‑new user             */
    /* ─────────────────────────────────────────────────────────── */
    console.log(" DEBUG - Path: CASE C (creating new user)");

    // user = await User.create({
    //   email,
    //   password: hashedPassword,
    //   role: roleNumber,
    //   isDeleted: false,
    //   verified: roleNumber === ROLES.ADMIN,
    // });
    user = await User.create({
      email,
      password: hashedPassword,
      role: roleNumber,
      isDeleted: false,
      fullName,
      verified: createdByAdmin && roleNumber === ROLES.SUB_ADMIN,
    });
    console.log(" DEBUG - New user created:", user._id);

    // create side‑document
    console.log(" DEBUG - Creating side documents, switch values:", {
      roleNumber,
      ROLES_CUSTOMER: ROLES.CUSTOMER,
    });

    switch (roleNumber) {
      case ROLES.VENDOR:
        console.log(" DEBUG - Executing VENDOR case in CASE C");
        try {
          const vendor = await VendorDetail.create({
            userId: user._id,
            businessName: "",
            ownerName: "",
            commercialRegNo: "",
            nationalIdNumber: "",
            businessPhone: "",
            whatsappNumber: null,
            location: { type: "Point", coordinates: [0, 0] },
            address: { street: "", city: "", state: "", country: "" },
            businessLogo: null,
            category: null,
            licenseDocument: "",
            bankOrMobilePayInfo: null,
            status: "Pending",
            profileComplete: false,
          });
          console.log(" DEBUG - VendorDetail created:", vendor._id);
        } catch (error) {
          console.error(" DEBUG - VendorDetail creation error:", error);
        }
        break;
      case ROLES.CUSTOMER:
        console.log(" DEBUG - Executing CUSTOMER case in CASE C");
        try {
          const customer = await CustomerDetail.create({
            userId: user._id,
            FullName: fullName,
          });
          console.log(" DEBUG - CustomerDetail created:", customer);
        } catch (error) {
          console.error(" DEBUG - CustomerDetail creation error:", error);
        }
        break;
      case ROLES.DRIVER:
        console.log(" DEBUG - Executing DRIVER case in CASE C");
        try {
          const driver = await DriverDetail.create({
            userId: user._id,
            FullName: fullName,
          });
          console.log(" DEBUG - DriverDetail created:", driver);
        } catch (error) {
          console.error(" DEBUG - DriverDetail creation error:", error);
        }
        break;
      default:
        console.log(" DEBUG - No case matched in CASE C switch");
    }

    // const { otpCode, otpExpiresAt, token } = await generateAndSendOtp(user);
    // user.otp = { code: otpCode, expiresAt: otpExpiresAt };
    // await user.save();
    if (createdByAdmin && roleNumber === ROLES.SUB_ADMIN) {
      const permissionDoc = await SubAdminPermission.create({
        userId: user._id,
        permissions,
      });
      return success(
        res,
        {
          user: {
            _id: user._id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            verified: user.verified,
          },
          permissions: permissionDoc?.permissions || [],
          availablePermissions: Object.values(PERMISSIONS),
        },
        "Sub-admin account created successfully.",
      );
    }

    // 📨 Normal users → OTP flow
    const { otpCode, otpExpiresAt, token } = await generateAndSendOtp(user);
    user.otp = { code: otpCode, expiresAt: otpExpiresAt };
    await user.save();

    return success(res, { token }, "Account registered. OTP sent to email.");

    // return success(res, { token }, "Account registered. OTP sent to email.");
  } catch (err) {
    console.error(" DEBUG - Create user error:", err);
    return serverError(res, err, "Failed to create account. Please try again.");
  }
};

export const loginController = async (req, res) => {
  try {
    const sessionUser = req.user;
    console.log(sessionUser, "sessionUser===================", req.body);
    if (!sessionUser) {
      return unauthorized(res, null, "Access denied. User not found.");
    }

    // Step 1: Extract device info from req.body
    const { deviceToken, deviceType } = req.body;
    console.log(sessionUser, "sessionUser===================", req.body);

    if (deviceToken && deviceType) {
      // Step 2: Update loginToken field in User collection
      await User.findByIdAndUpdate(sessionUser._id, {
        loginToken: {
          deviceToken,
          deviceType,
        },
      });
    }

    /* ─────────────  VERIFIED LOGIN  ───────────── */
    let vendorStatus = null;
    let profileComplete = null;
    let driverStatus = null;
    let detailEntityId = null; // <-- store correct detail ID for notification

    if (sessionUser.role === ROLES.VENDOR) {
      const vendor = await VendorDetail.findOne({ userId: sessionUser._id });
      if (!vendor) {
        return unauthorized(res, null, "Vendor details not found.");
      }
      vendorStatus = vendor.status;
      profileComplete = vendor.profileComplete;
      detailEntityId = vendor._id;
    }

    if (sessionUser.role === ROLES.DRIVER) {
      const driver = await DriverDetail.findOne({ userId: sessionUser._id });
      if (!driver) {
        return unauthorized(res, null, "Driver details not found.");
      }
      driverStatus = driver.status;
      profileComplete = driver.profileComplete;
      detailEntityId = driver._id;
    }

    if (sessionUser.role === ROLES.CUSTOMER) {
      const customer = await CustomerDetail.findOne({
        userId: sessionUser._id,
      });
      if (!customer) {
        return unauthorized(res, null, "Customer details not found.");
      }
      detailEntityId = customer._id;
    }

    //  For admin (or other roles that don’t have detail models)
    // if (sessionUser.role === ROLES.ADMIN) {
    //   // send directly using UserId instead of entityId
    //   detailEntityId = sessionUser._id;
    // }
    if (
      sessionUser.role === ROLES.ADMIN ||
      sessionUser.role === ROLES.SUB_ADMIN
    ) {
      detailEntityId = sessionUser._id;
    }
    let permissions = [];

    if (sessionUser.role === ROLES.SUB_ADMIN) {
      const permDoc = await SubAdminPermission.findOne({
        userId: sessionUser._id,
      });
      permissions = permDoc?.permissions || [];
    }

    const authPayload = {
      id: sessionUser._id,
      email: sessionUser.email,
      role: sessionUser.role,
      verified: true,
      permissions,
      ...(driverStatus && { status: driverStatus }),
      ...(vendorStatus && { status: vendorStatus }),
      ...(profileComplete !== null && { profileComplete }),
    };

    const authToken = jwt.sign(authPayload, process.env.JWT_SECRET);

    // 🔔 Send login notification for all roles
    if (deviceToken && deviceType && detailEntityId) {
      await sendNotification({
        entityId: detailEntityId,
        title: "Login Successful",
        body: `Welcome back, ${sessionUser.email}!`,
        data: { login: "true", role: sessionUser.role },
      });
    }

    return success(
      res,
      {
        token: authToken,
        user: {
          _id: sessionUser._id,
          permissions,
          tableId: detailEntityId, //tableId is _id of that particular role.
          email: sessionUser.email,
          role: sessionUser.role,
          verified: true,
          deviceToken: deviceToken || sessionUser.loginToken?.deviceToken,
          deviceType: deviceType || sessionUser.loginToken?.deviceType,
        },
        ...(driverStatus && { status: driverStatus }),
        ...(vendorStatus && { status: vendorStatus }),
        ...(profileComplete !== null && { profileComplete }),
      },
      "User logged in successfully.",
    );
  } catch (error) {
    console.error("Login error:", error);
    return serverError(res, error, "Failed to process login.");
  }
};

export const forgotPasswordController = async (req, res) => {
  try {
    console.log(req.body, "email====================req.body============");
    const email = req.body?.email || req.user?.email;
    const user = req.user;
    if (!email) return badRequest(res, null, "Email is required.");

    // Generate OTP and expiration
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    // Generate a secure JWT token (valid for 10 min)
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        expiresIn: otpExpiresAt,
      },
      process.env.JWT_SECRET,
    );

    // Save OTP
    user.otp = {
      code: otpCode,
      expiresAt: otpExpiresAt,
    };

    await user.save();

    // Send mail (you can customize subject/body)
    await sendMail({
      to: email,
      subject: "Your OTP Code",
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: ${COLORS.TEXT_DARK};">
            <div style="background: ${COLORS.PRIMARY}; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h2 style="color: ${COLORS.WHITE}; margin: 0;">Password Reset Request</h2>
            </div>
            <div style="padding: 20px; background: ${COLORS.BACKGROUND_LIGHT}; border-radius: 0 0 8px 8px;">
              <p>Hello,</p>
              <p>We received a request to reset your password. Use the following OTP to proceed: <strong>${otpCode}</strong>.This OPT will be valid for 10 minutes.</p>
              <p>If you didn't request this, please ignore this email.</p>
              <p style="margin-top: 30px;">Best regards,<br>Dual MarketPlace Team</p>
            </div>
          </div>`,
    });

    return success(res, { token }, "OTP sent successfully.");
  } catch (error) {
    console.error("Forgot password error:", error);
    return serverError(res, error, "Failed to process forgot password.");
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return unauthorized(res, null, "Authorization token is missing.");
    }
    const token = authHeader.split(" ")[1];
    const { otp } = req.body;

    const user = await verifyOtpAndGetUser(otp, token);
    // Create next token for confirming password
    const confirmResetToken = jwt.sign(
      { id: user._id, otp },
      process.env.JWT_SECRET,
      { expiresIn: "10m" },
    );

    return success(res, { token: confirmResetToken }, "OTP verified.");
  } catch (error) {
    console.error("OTP verification error:", error);
    return serverError(res, error, "OTP verification failed.");
  }
};

export const resetPasswordConfirm = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return unauthorized(res, null, "Authorization token is missing.");
    }
    const token = authHeader.split(" ")[1];
    const { newPassword } = req.body;

    if (!newPassword || !token) {
      return badRequest(res, null, "Password and token are required.");
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return unauthorized(res, null, "Invalid or expired token.");
    }

    const { id, otp } = decoded;
    const user = await User.findById(id);
    if (!user) {
      return unauthorized(res, null, "User not found.");
    }

    // Ensure OTP still matches
    if (!user.otp || user.otp.code !== otp) {
      return unauthorized(res, null, "OTP is invalid or has expired.");
    }

    const hashedPassword = await hash(newPassword, 10);
    user.password = hashedPassword;
    user.otp = undefined;
    await user.save();

    return success(res, null, "Password reset successful.");
  } catch (error) {
    console.error("Password reset confirm error:", error);
    return serverError(res, error, "Failed to reset password.");
  }
};

export const changePassword = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return unauthorized(res, null, "Authorization token is missing.");
    }
    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("Decoded token:", decoded);
    } catch (err) {
      return unauthorized(res, null, "Invalid or expired token.");
    }

    const { id } = decoded;
    const { oldPassword, newPassword, confirmPassword } = req.body;

    if (!oldPassword || !newPassword || !confirmPassword) {
      return badRequest(
        res,
        null,
        "Old password, new password, and confirm new password are required.",
      );
    }

    if (newPassword !== confirmPassword) {
      return badRequest(
        res,
        null,
        "New password and confirm password must match.",
      );
    }

    const user = await User.findById(id);
    if (!user) {
      return unauthorized(res, null, "User not found.");
    }

    const isMatch = await compare(oldPassword, user.password);
    if (!isMatch) {
      return unauthorized(res, null, "Old password is incorrect.");
    }

    const hashedPassword = await hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    return success(res, null, "Password changed successfully.");
  } catch (error) {
    console.error("Change password error:", error);
    return serverError(res, error, "Failed to change password.");
  }
};

export const socialSignUp = async (req, res) => {
  try {
    const { idToken, type, role } = req.body;

    if (!idToken || !role) {
      return badRequest(res, null, "idToken and role are required");
    }

    //  Convert role to number
    const roleNumber = Number(role);

    //  Validate role against ROLES
    if (!Object.values(ROLES).includes(roleNumber)) {
      console.warn(" Invalid role received in socialSignUp:", roleNumber);
      return badRequest(res, null, "Invalid role specified.");
    }

    // Step 1: Verify Google token
    const googleVerifyURL = `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`;
    const { data: googleData } = await axios.get(googleVerifyURL);
    const { email, sub: googleId, name } = googleData;

    if (!email || !googleId) {
      return badRequest(res, null, "Invalid or expired Google token");
    }

    //  Step 2: Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { email, role: roleNumber },
        { googleId, role: roleNumber },
      ],
      deleted: false,
    });

    if (existingUser) {
      console.warn(" User already exists with email or Google ID");
      return conflict(res, null, "User already exists. Please log in.");
    }

    //  Step 3: Create new user with hashed dummy password
    const dummyPassword = await bcrypt.hash(googleId, 10);
    const newUser = await User.create({
      email,
      password: dummyPassword,
      role: roleNumber,
      verified: true, // social users are considered verified
      googleId,
      deleted: false,
    });

    console.log(" New User created:", newUser._id);

    //  Step 4: Create side-document based on role
    let status = null;
    let profileComplete = null;

    switch (roleNumber) {
      case ROLES.VENDOR:
        console.log(" Creating VendorDetail for user:", newUser._id);
        const vendor = await VendorDetail.create({
          userId: newUser._id,
          businessName: name || "Unknown Business",
          ownerName: "",
          commercialRegNo: "",
          nationalIdNumber: "",
          businessPhone: "",
          whatsappNumber: null,
          location: { type: "Point", coordinates: [0, 0] },
          address: { street: "", city: "", state: "", country: "" },
          businessLogo: null,
          category: null,
          licenseDocument: "",
          bankOrMobilePayInfo: null,
          status: "Pending",
          profileComplete: false,
        });
        status = vendor.status;
        profileComplete = vendor.profileComplete;
        break;

      case ROLES.DRIVER:
        console.log(" Creating DriverDetail for user:", newUser._id);
        const driver = await DriverDetail.create({
          userId: newUser._id,
          FullName: name || "Unknown Driver",
          status: "Pending",
          profileComplete: false,
        });
        status = driver.status;
        profileComplete = driver.profileComplete;
        break;

      case ROLES.CUSTOMER:
        console.log(" Creating CustomerDetail for user:", newUser._id);
        await CustomerDetail.create({
          userId: newUser._id,
          FullName: name || "Unknown Customer",
        });
        break;

      default:
        console.warn(" Invalid role in socialSignUp switch:", roleNumber);
        return badRequest(res, null, "Invalid role specified.");
    }

    //  Step 5: Clean user object for response
    const cleanUser = {
      _id: newUser._id,
      email: newUser.email,
      role: newUser.role,
      verified: newUser.verified,
    };

    //  Step 6: Generate token
    const token = generateToken({
      _id: newUser._id,
      email: newUser.email,
      role: newUser.role,
      ...(status && { status }),
      ...(profileComplete !== null && { profileComplete }),
    });

    //  Step 7: Send response
    return dataCreated(
      res,
      {
        user: cleanUser,
        token,
        ...(status && { status }),
        ...(profileComplete !== null && { profileComplete }),
      },
      "User created successfully",
    );
  } catch (error) {
    if (error.response) {
      console.error(" Google token verification error:", error.response.data);
      return badRequest(res, error.response.data, "Google token error");
    } else {
      console.error(" Error in socialSignUp:", error);
      return serverError(res, error, "Signup failed");
    }
  }
};

export const socialLogin = async (req, res) => {
  try {
    const { idToken, type } = req.body;

    if (!idToken) {
      return badRequest(res, null, "idToken is required");
    }

    //  Step 1: Verify Google token
    const googleVerifyURL = `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`;
    const { data: googleData } = await axios.get(googleVerifyURL);
    const { email, sub: googleId, name } = googleData;

    if (!email || !googleId) {
      return badRequest(res, null, "Invalid or expired Google token");
    }

    // Step 2: Find user by googleId or email
    const user = await User.findOne({
      $or: [{ googleId }, { email }],
      deleted: false,
    });

    if (!user) {
      return unauthorized(res, null, "User not found. Please sign up first.");
    }

    //  Step 3: Fetch status & profileComplete based on role
    let status = null;
    let profileComplete = null;

    switch (user.role) {
      case ROLES.VENDOR:
        const vendor = await VendorDetail.findOne({ userId: user._id });
        if (vendor) {
          status = vendor.status;
          profileComplete = vendor.profileComplete;
        } else {
          console.warn(" VendorDetail not found for user:", user._id);
        }
        break;

      case ROLES.DRIVER:
        const driver = await DriverDetail.findOne({ userId: user._id });
        if (driver) {
          status = driver.status;
          profileComplete = driver.profileComplete;
        } else {
          console.warn(" DriverDetail not found for user:", user._id);
        }
        break;

      case ROLES.CUSTOMER:
        const customer = await CustomerDetail.findOne({ userId: user._id });
        if (!customer) {
          console.warn(" CustomerDetail not found for user:", user._id);
        }
        break;

      default:
        console.warn(" Invalid role in socialLogin:", user.role);
        return badRequest(res, null, "Invalid role specified.");
    }

    // Step 4: Clean user object for response
    const cleanUser = {
      _id: user._id,
      email: user.email,
      role: user.role,
      verified: user.verified,
    };

    //  Step 5: Generate token (include status & profileComplete if present)
    const token = generateToken({
      _id: user._id,
      email: user.email,
      role: user.role,
      ...(status && { status }),
      ...(profileComplete !== null && { profileComplete }),
    });

    //  Step 6: Send response
    return success(
      res,
      {
        user: cleanUser,
        token,
        ...(status && { status }),
        ...(profileComplete !== null && { profileComplete }),
      },
      "Login successful.",
    );
  } catch (error) {
    if (error.response) {
      console.error(" Google token verification error:", error.response.data);
      return badRequest(res, error.response.data, "Token verification failed.");
    } else {
      console.error(" Error in socialLogin:", error);
      return serverError(res, error, "Google sign-in failed.");
    }
  }
};

// fetch customer profile...
export const fetchCustomerProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(" DEBUG - User ID:", userId);
    if (!userId) {
      return unauthorized(res, null, "User not authenticated.");
    }

    const customer = await CustomerDetail.findOne({ userId });
    if (!customer) {
      return JsonRes.notFound(res, null, "Customer not found");
    }

    // Generate presigned URL for profile image if exists
    const profileImageUrls = customer.profileImage
      ? await getPresignedImageUrls([customer.profileImage]) // Pass as array
      : [];

    const profileImageUrl = profileImageUrls.length
      ? profileImageUrls[0]
      : null;

    const profileData = {
      _id: userId,
      email: req.user.email,
      role: req.user.role,
      verified: req.user.verified,
      fullName: customer.FullName,
      mobileNumber: customer.mobileNumber,
      profileImage: profileImageUrl,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };

    return success(res, profileData, "Customer profile fetched successfully.");
  } catch (error) {
    console.error("Error fetching customer profile:", error);
    return serverError(res, error, "Failed to fetch customer profile.");
  }
};

// update customer profile
export const updateCustomerProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    if (!userId) {
      return unauthorized(res, null, "User not authenticated.");
    }

    // Find the customer profile
    const customer = await CustomerDetail.findOne({ userId });
    if (!customer) {
      return notFound(res, null, "Customer profile not found.");
    }

    // Handle profile image upload
    if (req.file || (req.files && req.files.profileImage)) {
      try {
        // Get the file (handle both req.file and req.files.profileImage[0])
        const file =
          req.file || (req.files.profileImage && req.files.profileImage[0]);

        if (file) {
          // Store old image key for deletion
          const oldImageKey = customer.profileImage;

          // Generate unique S3 key for new image
          const timestamp = Date.now();
          const s3Key = `${S3TYPE.PROFILE}/${userId}/${timestamp}_${file.originalname}`;

          // Upload new image to S3
          await uploadImage({
            buffer: file.buffer,
            s3Name: s3Key,
          });

          // Delete old image if it exists
          if (oldImageKey) {
            await deleteObject(oldImageKey);
          }

          // Update customer profileImage
          customer.profileImage = s3Key;

          console.log(
            `Profile image uploaded successfully for user ${userId}: ${s3Key}`,
          );
        }
      } catch (uploadError) {
        console.error("Error uploading profile image:", uploadError);
        return serverError(res, uploadError, "Failed to upload profile image.");
      }
    }

    // Apply other updates from req.body (like FullName)
    Object.assign(customer, req.body);
    customer.updatedAt = Date.now();
    await customer.save();

    // Generate presigned URL for profile image
    const profileImageUrls = customer.profileImage
      ? await getPresignedImageUrls([customer.profileImage]) // Pass as array
      : [];

    const profileImageUrl = profileImageUrls.length
      ? profileImageUrls[0]
      : null;

    // Prepare response data combining User & CustomerDetail
    const profileData = {
      _id: userId,
      email: req.user.email,
      role: req.user.role,
      verified: req.user.verified,
      fullName: customer.FullName,
      mobileNumber: customer.mobileNumber,
      profileImage: profileImageUrl, // Return full presigned URL
      gender: customer.gender,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };

    console.log(`Customer profile updated successfully for user ${userId}`);
    return success(res, profileData, "Customer profile updated successfully.");
  } catch (error) {
    console.error("Error updating customer profile:", error);
    return serverError(res, error, "Failed to update customer profile.");
  }
};

// fetch driver profile...
export const fetchDriverProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(" DEBUG - User ID:", userId);
    if (!userId) {
      return unauthorized(res, null, "User not authenticated.");
    }

    const driver = await DriverDetail.findOne({ userId });
    if (!driver) {
      return JsonRes.notFound(res, null, "Driver not found");
    }

    // Generate presigned URL for profile image if exists
    const profileImageUrls = driver.profileImage
      ? await getPresignedImageUrls([driver.profileImage]) // Pass as array
      : [];

    const profileImageUrl = profileImageUrls.length
      ? profileImageUrls[0]
      : null;

    const profileData = {
      _id: userId,
      email: req.user.email,
      role: req.user.role,
      verified: req.user.verified,
      fullName: driver.FullName,
      mobileNumber: driver.mobileNumber,
      profileImage: profileImageUrl, // Return full presigned URL
      createdAt: driver.createdAt,
      updatedAt: driver.updatedAt,
      driverType: driver.driverType,
      vehicleType: driver.vehicleType,
    };

    return success(res, profileData, "Driver profile fetched successfully.");
  } catch (error) {
    console.error("Error fetching driver profile:", error);
    return serverError(res, error, "Failed to fetch driver profile.");
  }
};

// update driver profile...
export const updateDriverProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    if (!userId) {
      return unauthorized(res, null, "User not authenticated.");
    }

    // Find the driver profile
    const driver = await DriverDetail.findOne({ userId });
    if (!driver) {
      return notFound(res, null, "Driver profile not found.");
    }

    // Handle profile image upload
    if (req.file || (req.files && req.files.profileImage)) {
      try {
        const file =
          req.file || (req.files.profileImage && req.files.profileImage[0]);

        if (file) {
          // Store old image key for deletion
          const oldImageKey = driver.profileImage;

          // Generate unique S3 key for new image
          const timestamp = Date.now();
          const s3Key = `${S3TYPE.PROFILE}/${userId}/${timestamp}_${file.originalname}`;

          // Upload new image to S3
          await uploadImage({
            buffer: file.buffer,
            s3Name: s3Key,
          });

          // Delete old image if it exists
          if (oldImageKey) {
            await deleteObject(oldImageKey);
          }

          // Update driver profileImage
          driver.profileImage = s3Key;

          console.log(
            `Profile image uploaded successfully for driver ${userId}: ${s3Key}`,
          );
        }
      } catch (uploadError) {
        console.error("Error uploading profile image:", uploadError);
        return serverError(res, uploadError, "Failed to upload profile image.");
      }
    }

    // Apply other updates from req.body (like FullName)
    Object.assign(driver, req.body);
    driver.updatedAt = Date.now();
    await driver.save();

    // Generate presigned URL for profile image
    const profileImageUrls = driver.profileImage
      ? await getPresignedImageUrls([driver.profileImage]) // Pass as array
      : [];

    const profileImageUrl = profileImageUrls.length
      ? profileImageUrls[0]
      : null;

    // Prepare response data combining User & DriverDetail
    const profileData = {
      _id: userId,
      email: req.user.email,
      role: req.user.role,
      verified: req.user.verified,
      fullName: driver.FullName,
      mobileNumber: driver.mobileNumber,
      profileImage: profileImageUrl, // Return full presigned URL
      createdAt: driver.createdAt,
      updatedAt: driver.updatedAt,
      vehicleType: driver.vehicleType,
      driverType: driver.driverType,
    };

    console.log(`Driver profile updated successfully for user ${userId}`);
    return success(res, profileData, "Driver profile updated successfully.");
  } catch (error) {
    console.error("Error updating driver profile:", error);
    return serverError(res, error, "Failed to update driver profile.");
  }
};

/**
 * Get logged-in user's notifications
 * @route GET /user/notifications
 * @access Private
 */
// Customer notifications
export const getCustomerNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Notification.countDocuments({ userId });

    return success(
      res,
      { notifications, total, page, limit },
      "Customer notifications fetched successfully.",
    );
  } catch (error) {
    console.error("Error fetching customer notifications:", error);
    return serverError(res, error, "Failed to fetch notifications.");
  }
};

// Driver notifications
export const getDriverNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Notification.countDocuments({ userId });

    return success(
      res,
      { notifications, total, page, limit },
      "Driver notifications fetched successfully.",
    );
  } catch (error) {
    console.error("Error fetching driver notifications:", error);
    return serverError(res, error, "Failed to fetch notifications.");
  }
};

/**
 * Soft delete user account
 * @route DELETE /user/account
 * @access Private (All authenticated users)
 */
export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!userId) {
      return unauthorized(res, null, "User not authenticated.");
    }

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return notFound(res, null, "User not found.");
    }

    // Check if already deleted
    if (user.deleted) {
      return badRequest(res, null, "Account is already deleted.");
    }

    // Soft delete the user account
    user.deleted = true;
    await user.save();

    // Handle role-specific deletions and cleanup
    switch (userRole) {
      case ROLES.CUSTOMER:
        const customer = await CustomerDetail.findOne({ userId });
        if (customer) {
          // Delete profile image from S3 if exists
          if (customer.profileImage) {
            try {
              await deleteObject(customer.profileImage);
              console.log(
                `Deleted customer profile image: ${customer.profileImage}`,
              );
            } catch (error) {
              console.error("Error deleting customer profile image:", error);
            }
          }

          // Mark as deleted (assuming your schema has isDeleted field)
          customer.isDeleted = true;
          await customer.save();
        }
        break;

      case ROLES.DRIVER:
        const driver = await DriverDetail.findOne({ userId });
        if (driver) {
          // Delete profile image from S3 if exists
          if (driver.profileImage) {
            try {
              await deleteObject(driver.profileImage);
              console.log(
                `Deleted driver profile image: ${driver.profileImage}`,
              );
            } catch (error) {
              console.error("Error deleting driver profile image:", error);
            }
          }

          // Delete driver documents if they exist
          const documentsToDelete = [
            driver.licenseDocument,
            driver.vehicleRegistration,
            driver.insurance,
            driver.identityProof,
          ].filter(Boolean); // Remove null/undefined values

          for (const doc of documentsToDelete) {
            try {
              await deleteObject(doc);
              console.log(`Deleted driver document: ${doc}`);
            } catch (error) {
              console.error(`Error deleting driver document ${doc}:`, error);
            }
          }

          // Mark as deleted
          driver.isDeleted = true;
          await driver.save();
        }
        break;

      case ROLES.VENDOR:
        const vendor = await VendorDetail.findOne({ userId });
        if (vendor) {
          // Delete business logo from S3 if exists
          if (vendor.businessLogo) {
            try {
              await deleteObject(vendor.businessLogo);
              console.log(
                `Deleted vendor business logo: ${vendor.businessLogo}`,
              );
            } catch (error) {
              console.error("Error deleting vendor business logo:", error);
            }
          }

          // Delete license document if exists
          if (vendor.licenseDocument) {
            try {
              await deleteObject(vendor.licenseDocument);
              console.log(
                `Deleted vendor license document: ${vendor.licenseDocument}`,
              );
            } catch (error) {
              console.error("Error deleting vendor license document:", error);
            }
          }

          // Mark as deleted
          vendor.isDeleted = true;
          await vendor.save();
        }
        break;

      case ROLES.ADMIN:
        // Admin accounts - just log
        console.log(`Admin account deletion requested: ${userId}`);
        break;

      default:
        console.warn(`Unknown role during account deletion: ${userRole}`);
    }

    // Delete all user notifications
    try {
      await Notification.deleteMany({ userId });
      console.log(`Deleted all notifications for user: ${userId}`);
    } catch (error) {
      console.error("Error deleting notifications:", error);
    }

    console.log(
      `Account successfully deleted for user: ${userId}, role: ${userRole}`,
    );

    return success(
      res,
      null,
      "Account deleted successfully. We're sorry to see you go.",
    );
  } catch (error) {
    console.error("Error deleting account:", error);
    return serverError(res, error, "Failed to delete account.");
  }
};

/**
 * Toggle notifications on/off for the logged-in user
 */
export const toggleNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    const { enabled } = req.body;

    if (enabled === undefined) {
      return res
        .status(400)
        .json({ success: false, message: "Missing 'enabled' field." });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { notificationsEnabled: enabled },
      { new: true },
    );

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    return res.status(200).json({
      success: true,
      message: `Notifications ${enabled ? "enabled" : "disabled"} successfully.`,
      notificationsEnabled: user.notificationsEnabled,
    });
  } catch (err) {
    console.error("❌ toggleNotification error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

export const getPermissions = async (req, res) => {
  return res.json({
    status: true,
    data: Object.values(PERMISSIONS),
  })
}

export const getSubAdmins = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1
    const pageSize = Number(req.query.pageSize) || 10
    const search = req.query.search || ''

    const query = {
      role: ROLES.SUB_ADMIN,
      ...(search && {
        $or: [
          { email: { $regex: search, $options: 'i' } },
          { fullName: { $regex: search, $options: 'i' } },
        ],
      }),
    }

    const totalRecords = await User.countDocuments(query)

    const users = await User.find(query)
      .select('_id email fullName role verified createdAt')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .sort({ createdAt: -1 })
      .lean()

    const userIds = users.map((u) => u._id)

    const permissions = await SubAdminPermission.find({
      userId: { $in: userIds },
    }).lean()

    const permissionMap = {}
    permissions.forEach((p) => {
      permissionMap[p.userId.toString()] = p.permissions
    })

    const data = users.map((u) => ({
      ...u,
      permissions: permissionMap[u._id.toString()] || [],
    }))

    return res.json({
      status: true,
      data,
      totalRecords,
      currentPage: page,
      pageSize,
    })
  } catch (err) {
    console.error('Get sub-admins error:', err)
    return res.status(500).json({
      status: false,
      message: 'Failed to fetch sub-admins',
    })
  }
}

export const updateSubAdmin = async (req, res) => {
  try {
    const { id } = req.params
    const { permissions, password } = req.body

    const user = await User.findOne({
      _id: id,
      role: ROLES.SUB_ADMIN,
    })

    if (!user) {
      return res.status(404).json({
        status: false,
        message: 'Sub-admin not found',
      })
    }

    // 🔐 Update password (optional)
    if (password) {
      user.password = await bcrypt.hash(password, 10)
      await user.save()
    }

    // 🔑 Update permissions
    if (permissions) {
      const invalid = permissions.filter(
        (p) => !Object.values(PERMISSIONS).includes(p),
      )

      if (invalid.length > 0) {
        return res.status(400).json({
          status: false,
          message: `Invalid permissions: ${invalid.join(', ')}`,
        })
      }

      await SubAdminPermission.findOneAndUpdate(
        { userId: user._id },
        { permissions },
        { new: true, upsert: true },
      )
    }

    return res.json({
      status: true,
      message: 'Sub-admin updated successfully',
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({
      status: false,
      message: 'Failed to update sub-admin',
    })
  }
}

export const deleteSubAdmin = async (req, res) => {
  try {
    const { id } = req.params

    const user = await User.findOne({
      _id: id,
      role: ROLES.SUB_ADMIN,
    })

    if (!user) {
      return res.status(404).json({
        status: false,
        message: 'Sub-admin not found',
      })
    }

    await User.deleteOne({ _id: id })
    await SubAdminPermission.deleteOne({ userId: id })

    return res.json({
      status: true,
      message: 'Sub-admin deleted successfully',
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({
      status: false,
      message: 'Failed to delete sub-admin',
    })
  }
}
