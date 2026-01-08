import { Router } from "express";
import AdValidate from "../controllers/advertisement/validation.js";
import * as AC from "../controllers/advertisement/index.js";
import {
  verifyCustomer,
  verifyAdmin,
  verifyVendor,
} from "../middleware/auth.js";
import { advertisementImageUpload } from "../middleware/advertisemenrupload.js";

const router = Router();

/*************************** POST Routes ***************************/
router.post(
  "/create",
  verifyCustomer,
  advertisementImageUpload,
  AC.createAdvertisement
);
/****************************** END ********************************/




/*************************** PATCH Routes ***************************/
router.patch("/update/:id", verifyCustomer, advertisementImageUpload, AC.updateAdvertisement);
router.patch("/approve/:id", verifyAdmin, AC.approveAdvertisement);
router.patch("/reject/:id", verifyAdmin, AC.rejectAdvertisement);
/****************************** END ********************************/



/*************************** GET Routes ***************************/
router.get("/getAdvertisement", AC.getAdvertisements);
router.get("/getAdvertisement/:id",verifyCustomer, AC.getAdvertisementById);
router.get("/getMyAdvertisements", verifyCustomer, AC.getMyAdvertisements);
/****************************** END *******************************/




/*************************** DELETE Route **************************/
router.delete("/deleteAdsByAdmin/:id",verifyAdmin, AC.deleteAdvertisementByAdmin);
router.delete("/delete/:id", verifyCustomer, AC.deleteAdvertisement);
/******************************* END *******************************/




export default router;
