import User from "../models/user/user.js";
import jwt from "jsonwebtoken";
import JsonRes from "../helpers/response.js";
import { ROLES } from "../utils/constant.js";
const {
  badRequest,
  conflict,
  success,
  serverError,
  failed,
  dataCreated,
  unauthorized,
} = JsonRes;

// Replace this with your actual JWT secret key
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

export const verifyAdmin = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return unauthorized(res, null, "Authorization token is missing.");
    }

    const token = authHeader.split(" ")[1];

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if role is admin (role === 10)
    if (!decoded || decoded.role !== ROLES.ADMIN) {
      return unauthorized(res, null, "Access denied. Admins only.");
    }

    // Attach decoded user info to request
    req.user = decoded;
    next();
  } catch (error) {
    console.error("JWT verification error:", error);
    return serverError(res, error, "Invalid or expired token.");
  }
};

export const verifyVendor = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return unauthorized(res, null, "Authorization token is missing.");
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || decoded.role !== ROLES.VENDOR) {
      return unauthorized(res, null, "Access denied. Vendors only.");
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error("JWT verification error:", error);
    return serverError(res, error, "Invalid or expired token.");
  }
};

export const verifyCustomer = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return unauthorized(res, null, "Authorization token is missing.");
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded || decoded.role !== ROLES.CUSTOMER) {
      return unauthorized(res, null, "Access denied. Customers only.");
    }

    // Normalize user object
    req.user = {
      id: decoded._id || decoded.id, 
      email: decoded.email,
      role: decoded.role,
      verified: decoded.verified,
    };

    next();
  } catch (error) {
    console.error("JWT verification error:", error);
    return serverError(res, error, "Invalid or expired token.");
  }
};

export const verifyDriver = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return unauthorized(res, null, "Authorization token is missing.");
    }

    const token = authHeader.split(" ")[1];

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log("Decoded JWT:", decoded.role);
    // Check if role is admin (role === 1)
    if (!decoded || decoded.role !== ROLES.DRIVER) {
      return unauthorized(res, null, "Access denied. Drivers only.");
    }

    // Normalize user object
    req.user = {
      id: decoded._id || decoded.id, 
      email: decoded.email,
      role: decoded.role,
      verified: decoded.verified,
    };
    next();
  } catch (error) {
    console.error("JWT verification error:", error);
    return serverError(res, error, "Invalid or expired token.");
  }
};