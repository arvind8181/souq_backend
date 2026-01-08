import { Router } from "express";
import OrderValidate from "../controllers/order/validation.js";
import * as MU from "../middleware/login.js";
import * as Reportcontroller from "../controllers/report/index.js";
import { login } from "../middleware/login.js";
import { ROLES } from "../utils/constant.js";
import {
  verifyVendor,
} from "../middleware/auth.js";
const router = Router();

/*************************** Get Routes ***************************/
router.get(`/sales`, verifyVendor, Reportcontroller.getSalesReport);
/******************************* END ******************************/
export default router;
