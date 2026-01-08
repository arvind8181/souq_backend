import { Router } from "express";
import * as DriverController from "../controllers/driverCommission/index.js";
import { verifyAdmin } from "../middleware/auth.js";
const router = Router();

/*************************** Post Routes ***************************/
router.post(`/update`, verifyAdmin, DriverController.updateCommission);
/******************************* END *******************************/

/*************************** Get Routes ***************************/
router.get(`/`, verifyAdmin, DriverController.getCommission);
/******************************* END ******************************/

export default router;
