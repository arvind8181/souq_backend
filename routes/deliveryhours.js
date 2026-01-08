import { Router } from "express";
import VendorDeliveryHourValidate from "../controllers/deliveryHours/validations.js";
import * as VendorDeliveryHourController from "../controllers/deliveryHours/index.js";
import { verifyVendor } from "../middleware/auth.js";

const router = Router();

/*************************** POST Routes ***************************/
router.post(
  `/create`,
  verifyVendor,
  VendorDeliveryHourValidate.createOrUpdate,
  VendorDeliveryHourController.createOrUpdateDeliveryHour
);
/****************************** END ********************************/


/*************************** GET Routes ****************************/
router.get(`/`, verifyVendor, VendorDeliveryHourController.getVendorDeliveryHours);
/****************************** END *******************************/

export default router;
