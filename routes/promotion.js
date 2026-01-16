import express from "express";
import * as PromotionController from "../controllers/promotion/index.js";
import {
  verifyAdmin,
  verifyVendor,
} from "../middleware/auth.js";
import PromotionValidate from "../controllers/promotion/validation.js";
const router = express.Router();

router.post(
  "/add-promotion",
  verifyVendor,
  PromotionValidate.createPromotion,
  PromotionController.addPromotion
);

router.get("/promotions", verifyVendor, PromotionController.getPromotions);

router.put(
  "/promotion/:id",
  verifyVendor,
  PromotionValidate.createPromotion,
  PromotionController.updatePromotion
);
router.delete(
  "/promotion/:id",
  verifyVendor,
  PromotionController.deletePromotion
);
router.get(
  "/promotions/admin",
  verifyAdmin,
  PromotionController.getAllPromotions
);
router.post("/update/status", verifyAdmin, PromotionController.updateStatus);

export default router;
