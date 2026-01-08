import { Router } from "express";
import OrderValidate from "../controllers/order/validation.js";
import * as MU from "../middleware/login.js";
import * as DashboardController from "../controllers/dashboard/index.js";
import { login } from "../middleware/login.js";
import { ROLES } from "../utils/constant.js";
import {
  verifyCustomer,
  verifyAdmin,
  verifyVendor,
} from "../middleware/auth.js";
const router = Router();

/*************************** Get Routes ***************************/
router.get(`/`, verifyVendor, DashboardController.getDailySales);
router.get(`/admin`, verifyAdmin, DashboardController.getAdminDashboards);
router.get(
  "/admin/sales",
  verifyAdmin,
  DashboardController.getAdminSalesLineGraph
);
/******************************* END ******************************/
export default router;
