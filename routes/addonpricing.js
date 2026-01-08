import { Router } from "express";
import * as AddonPricingController from "../controllers/addonpricing/index.js";
import { verifyAdmin } from "../middleware/auth.js";
const router = Router();

/*************************** Post Routes ***************************/
router.post(`/update`, verifyAdmin, AddonPricingController.updateAddonPricing);
/******************************* END *******************************/

/*************************** Get Routes ***************************/
router.get(`/`, verifyAdmin, AddonPricingController.getAddonPricing);
/******************************* END ******************************/

export default router;
