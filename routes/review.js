import express from "express";
import * as ReviewController from "../controllers/review/index.js";
import {verifyCustomer, verifyVendor} from "../middleware/auth.js";
import { reviewImageUpload } from "../middleware/reviewImageUpload.js";


const router = express.Router();

router.post("/add-review/:productid", verifyCustomer,reviewImageUpload, ReviewController.addReview);
router.post("/update-review/:reviewId", verifyVendor, ReviewController.replyToReview);                    
router.get("/get-reviews/:id", ReviewController.getReviewsByProductId);
router.get("/get-ratings/:id", ReviewController.getRatingsByProductId);
router.get("/getOnlyProductsWithReviewsAndRatings", ReviewController.getOnlyProductsWithReviewsAndRatings);
router.delete("/delete-review/:productid", verifyCustomer, ReviewController.deleteReview);

export default router;
