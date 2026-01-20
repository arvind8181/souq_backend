import { Router } from "express";
import OrderValidate from "../controllers/order/validation.js";
import * as MU from "../middleware/login.js";
import * as OrderController from "../controllers/order/index.js";
import { login } from "../middleware/login.js";
import { ROLES } from "../utils/constant.js";
import {
  verifyCustomer,
  verifyAdmin,
  verifyVendor,
  verifyDriver,
} from "../middleware/auth.js";


const router = Router();
/*************************** Post Routes **************************************************************/
router.post(`/create`, verifyCustomer, OrderValidate.create, OrderController.createOrder);
router.post(`/active`, verifyAdmin, OrderController.getActiveOrders);
router.post(`/update-status`, OrderController.updateStatus);
router.post(`/vendor-orders`, verifyVendor, OrderController.getVendorOrders);
router.post("/reassign-order", verifyDriver, OrderController.reassignDriver);
router.post("/requestReturn", verifyCustomer, OrderController.requestReturn);
/******************************* END *******************************************************************/



/*************************** Patch Routes **************************************************************/
router.patch("/assign-driver", OrderController.assignReturnDriver); 
router.patch("/pickup-confirm", verifyDriver, OrderController.confirmPickup);
router.patch("/vendorConfirmation", verifyVendor, OrderController.confirmVendorReceipt);
/******************************* END *******************************************************************/



/*************************** Get Routes ****************************************************************/
router.get("/delivery-estimate", verifyDriver, OrderController.getOrderDeliveryInforInDriverSide);
router.get("/ordersHistoryOfDriver", verifyDriver, OrderController.getDriverOrderHistory);
router.get("/getActiveOrdersForCustomer", verifyCustomer, OrderController.getActiveOrdersForCustomer);
router.get("/getActiveOrdersByOrderId/:orderId/:vendorId", OrderController.getActiveOrderByOrderIdAndVendorId);
router.get("/getOrderHistoryOfCustomer", verifyCustomer, OrderController.getOrderHistoryOfCustomer);
router.get("/vendor-financial-breakdown", verifyVendor, OrderController.getVendorFinancialBreakdown);
router.get("/admin-financial-breakdown", verifyAdmin, OrderController.getAdminFinancialBreakdown);
router.get("/driver-financial-breakdown", verifyDriver, OrderController.getDriverFinancialBreakdown);
/******************************* END *******************************************************************/




export default router;
