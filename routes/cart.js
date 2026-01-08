import express from "express";
import * as CC from "../controllers/cart/index.js";
import { verifyCustomer } from "../middleware/auth.js"; 
const router = express.Router();




/************************************************************************
 * POST Routes
 ************************************************************************/

router.post("/addCart", verifyCustomer, CC.addToCart);


/************************************************************************
 * POST Routes
 ************************************************************************/
router.patch("/updateCart", verifyCustomer, CC.updateCartItemQuantity);


/************************************************************************
 * GET Routes
 ************************************************************************/
router.get("/getCart", verifyCustomer, CC.getCart);

/************************************************************************
 * DELETE Routes
 ************************************************************************/
router.delete("/deleteCartItem/:productId", verifyCustomer, CC.deleteCartItem);


export default router;
