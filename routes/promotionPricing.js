import { Router } from "express";
import * as PromotionPricingController from "../controllers/promotionPricing/index.js";
import { verifyAdmin } from "../middleware/auth.js";
const router = Router();

/*************************** Post Routes ***************************/
router.post(`/update`, verifyAdmin, PromotionPricingController.updatePromotionPricing);
/******************************* END *******************************/

/*************************** Get Routes ***************************/
router.get(`/`, verifyAdmin, PromotionPricingController.getPromotionPricing);
/******************************* END ******************************/

export default router;
