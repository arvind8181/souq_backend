import { Router } from "express";
import VenderValidate from "../controllers/vendorDetails/validation.js";
import * as DriverController from "../controllers/driver/index.js";
import { verifyAdmin, verifyDriver, verifyVendor } from "../middleware/auth.js";
import UserValidate from "../controllers/user/validation.js";
import { driverDocsUpload } from "../middleware/driverupload.js";
const router = Router();

/*************************** Post Routes ***************************/
router.post(
  "/doc/upload",
  verifyDriver,
  driverDocsUpload,
  DriverController.driverDocUpload
);
router.post(`/update/status`, verifyAdmin, DriverController.updateDriverStatus);
router.post(`/update/location`, verifyDriver, DriverController.updateDriverLocation);
/******************************* END *******************************/

/*************************** Get Routes ***************************/
router.get(`/pending`, verifyAdmin, DriverController.getPendingDrivers);
router.get("/getDoc/:id", verifyDriver, DriverController.getDriverDoc);
router.get(`/admin/all-drivers`, verifyAdmin, DriverController.getAllDrivers);
/******************************* END ******************************/

/*************************** Patch Routes ***************************/
router.patch(
  "/updateDoc",
  verifyDriver,
  driverDocsUpload,
  DriverController.updateDriverDoc
);
router.patch('/toggleAvailability', verifyDriver, DriverController.toggleDriverAvailability);
/******************************* END ******************************/

export default router;
