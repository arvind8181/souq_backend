import express from "express";
import { verifyAdmin, verifyVendor } from "../middleware/auth.js";
import * as BoostPricing from "../controllers/boost/boostpricing.js";
const router = express.Router();

router.get("/", BoostPricing.getBoostPricing);
router.post("/update", verifyAdmin, BoostPricing.updateBoostPricing);

export default router;
