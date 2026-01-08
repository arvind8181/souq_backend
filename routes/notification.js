import { Router } from "express";
import OrderValidate from "../controllers/order/validation.js";
import * as MU from "../middleware/login.js";
import * as NotificationController from "../controllers/notification/index.js";
import { login } from "../middleware/login.js";
import { ROLES } from "../utils/constant.js";
import {
  verifyCustomer,
  verifyAdmin,
  verifyVendor,
} from "../middleware/auth.js";
const router = Router();

/*************************** Post Routes ***************************/
router.post(`/update`, NotificationController.markAsRead);
/******************************* END *******************************/

/*************************** Get Routes ***************************/

/******************************* END ******************************/
export default router;
