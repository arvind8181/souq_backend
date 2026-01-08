import { Router } from "express";
import { verifyCustomer } from "../middleware/auth.js";
import * as PaypalController from "../controllers/paypal/paypalOrder.js";

const router = Router();

/*************************** Post Routes **************************************************************/
// Create a PayPal order (after placing order in DB)
router.post("/create-order", verifyCustomer, PaypalController.createPaypalOrder);

// Capture PayPal payment after approval
router.post("/capture-order", verifyCustomer, PaypalController.capturePaypalOrder);
/******************************* END *******************************************************************/

export default router;
