import { Router } from "express";
import * as DriverCashLedgerController from "../controllers/driverCashLedger/driverCashLedger.js";
import { verifyDriver, verifyAdmin } from "../middleware/auth.js";

const router = Router();

/*************************** Post Routes ***************************/
// ✅ Driver updates cash collection after delivery
router.post(
  "/update-cash-collection",
  verifyDriver,
  DriverCashLedgerController.updateCashCollection
);

router.post(
    "/driverPaysToAdmin",
    verifyDriver,
    DriverCashLedgerController.driverPaysToAdmin
)

router.post(
    "/adminApproveDriverPayment",
    verifyAdmin,
    DriverCashLedgerController.adminApproveDriverPayment
)
/******************************* END *******************************/


/*************************** Get Routes ***************************/
router.get(`/getDriverCashLedger`, DriverCashLedgerController.getDriverCashLedger);
/******************************* END *******************************/




export default router;
