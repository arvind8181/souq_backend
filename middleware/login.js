import User from "../models/user/user.js";
import { compare } from "bcryptjs";
import JsonRes from "../helpers/response.js";
import jwt from "jsonwebtoken";
const {
  badRequest,
  conflict,
  success,
  serverError,
  failed,
  dataCreated,
  unauthorized,
} = JsonRes;
export const login = async (req, res, next) => {
  try {
    const { email, password, role } = req.body;

    // Basic validation
    if (!email || !password) {
      return badRequest(res, null, "Email and password are required.");
    }

    // 1. Find user by email
    const user = await User.findOne({
      email,
      role,
      deleted: false,
      verified: true,
    });
    if (!user) {
      return unauthorized(res, null, "Invalid email or password.");
    }

    // 2. Compare password
    const isMatch = await compare(password, user.password);
    if (!isMatch) {
      return unauthorized(res, null, "Invalid email or password.");
    }

    // 3. Sanitize user data (remove password)
    const userWithoutPassword = user.toObject();
    delete userWithoutPassword.password;

    // 4. Attach user to request
    req.user = userWithoutPassword;
    next();
  } catch (error) {
    console.error("Login middleware error:", error);
    return serverError(res, error, "Internal server error.");
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    let email, role;

    // 1️⃣ Try to extract from Authorization header
    if (req.body.email && req.body.role != null) {
      email = req.body.email;
      role = req.body.role;
    } else {
      // 2️⃣ Fallback to Authorization header (Bearer token)
      const authHeader = req.headers.authorization;

      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];

        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          email = decoded.email;
          role = decoded.role;
        } catch (err) {
          return unauthorized(res, null, "Invalid or expired token.");
        }
      } else {
        return badRequest(res, null, "Email and role are required.");
      }
    }
    // console.log(email, role);
    // 3️⃣ Lookup user
    const user = await User.findOne({ email, role, deleted: false });
    if (!user) {
      return unauthorized(res, null, "User not found or unauthorized.");
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("forgotPassword middleware error:", error);
    return serverError(res, error, "Internal server error.");
  }
};
