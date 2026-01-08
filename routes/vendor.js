import { Router } from "express";
import VenderValidate from "../controllers/vendorDetails/validation.js";
import * as VenderController from "../controllers/vendorDetails/index.js";
import {
  verifyAdmin,
  verifyVendor,
  verifyCustomer,
} from "../middleware/auth.js";
import UserValidate from "../controllers/user/validation.js";
import {
  VendorDocsUpload,
  validateRequest,
} from "../middleware/vendorupload.js";
const router = Router();

/*************************** Post Routes ***************************/

// router.post(`/verify/otp`, UserValidate.verfiyopt, VenderController.verifyOtp);
// router.post(`/resend/otp`, VenderController.resendOtp);
router.post(`/update/status`, verifyAdmin, VenderController.updateVendorStatus);
router.post(
  "/update-profile",
  verifyVendor,
  VenderValidate.updateVendorProfile,
  VendorDocsUpload,
  VenderController.updateVendorProfile
);
router.post(
  "/vendors/nearby",
  verifyCustomer,
  VenderController.getNearbyVendors
);
router.post(
  "/vendors/getAllProductsOfMinutesAndMarketPlace",
  verifyCustomer,
  VenderController.getAllProductsOfMinutesAndMarketPlace
)
router.post(
  "/primium/subscribe",
  verifyVendor,
  VenderController.subscribeVendor
);
router.post(
  "/primium/update",
  verifyAdmin,
  VenderController.updateVendorSubscription
);
/******************************* END *******************************/

/*************************** Get Routes ***************************/
router.get(`/pending`, verifyAdmin, VenderController.getPendingVendors);
router.get(`/`, verifyVendor, VenderController.getVendor);
router.get(`/admin-vendors`, verifyAdmin, VenderController.getVendors);
router.get(`/admin/all-vendors`, verifyAdmin, VenderController.getAllVendors);
router.get("/getVendorProducts/:vendorId", VenderController.getVendorProducts);
router.post("/getMarketplaceCombinedForHomeApi",verifyCustomer, VenderController.getMarketplaceCombinedForHomeApi);
/******************************* END ******************************/
export default router;
