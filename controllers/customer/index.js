import { hash } from "bcryptjs";
import JsonRes from "../../helpers/response.js";
import User from "../../models/user/user.js";
import CustomerDetail from "../../models/customerDetails/customerDetails.js";
import jwt from "jsonwebtoken";
import { ROLES } from "../../utils/constant.js";
const {
  badRequest,
  conflict,
  success,
  serverError,
  failed,
  dataCreated,
  unauthorized,
} = JsonRes;


// export const getVendors = async (req, res) => {
//   try {
//     const userId = req.user.id;

//     const Vendor = await VendorDetail.findOne({
//       // <-- fixed typo here
//       userId: userId,
//     }).populate({
//       path: "userId",
//       select: "email",
//       model: User,
//     });

//     return success(res, Vendor, "Fetched vendor successfully.");
//   } catch (error) {
//     console.error("Error fetching vendor:", error);
//     return serverError(res, error, "Failed to fetch vendor.");
//   }
// };
