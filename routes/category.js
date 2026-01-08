import express from "express";
import * as FC from "../controllers/category/index.js";
import {verifyAdmin} from "../middleware/auth.js";
import e from "express";

const router = express.Router();

router.post("/create", verifyAdmin, FC.createCategory);
router.patch("/updateCategory/:id", verifyAdmin, FC.updateCategory);
router.get("/getCategory", FC.getAllCategories);
router.get("/getCategory/:id", FC.getCategoryById);
router.delete("/deleteCategory/:id", verifyAdmin, FC.deleteCategory);

export default router;