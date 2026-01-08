import express from "express";
import * as FC from "../controllers/favourite/index.js";
import { verifyCustomer } from "../middleware/auth.js";

const router = express.Router();

router.post("/create/:itemId", verifyCustomer, FC.addFavorite);
router.get("/getFavorites", verifyCustomer, FC.getFavorites);
router.delete("/removeFavorites/:itemId", verifyCustomer, FC.removeFavorite);

export default router;
