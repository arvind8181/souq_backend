import { Router } from "express";
import CustomerDetailValidate from "../controllers/customer/validation.js";
import * as CustomerController from "../controllers/customer/index.js";
import { verifyAdmin, verifyVendor } from "../middleware/auth.js";
import * as ProductController from "../controllers/products/index.js";
const router = Router();

/*************************** Post Routes ***************************/

// router.post(
//   `/update/status`,
//   verifyVendor,
//   VenderController.updateVendorStatus
// );

/******************************* END *******************************/

/*************************** Get Routes ***************************/
// router.get(`/pending`, verifyAdmin, VenderController.getPendingVendors);
// router.get(`/`, verifyVendor, VenderController.getVendors);
/******************************* END ******************************/
export default router;
