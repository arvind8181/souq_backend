import express from "express";
import * as BoostController from "../controllers/boost/index.js";
import { verifyAdmin, verifyVendor } from "../middleware/auth.js";
import BoostValidate from "../controllers/boost/validation.js";

const router = express.Router();

console.log("✅ boosts route file loaded");

router.post(
  "/add-boost",
  verifyVendor,
  BoostValidate.createBoost,
  BoostController.addBoost,
);

router.put(
  "/boost/:id",
  verifyVendor,
  BoostValidate.createBoost,
  BoostController.updateBoost,
);

router.get("/boosts", verifyVendor, BoostController.getBoosts);

router.post("/:id/stop", verifyVendor, BoostController.stopBoost);

router.delete("/:id", verifyVendor, BoostController.deleteBoost);

router.get("/admin", verifyAdmin, BoostController.getAllBoosts);

router.post("/update-status", verifyAdmin, BoostController.updateStatus);

export default router;
