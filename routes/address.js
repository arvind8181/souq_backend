import { Router } from "express";
import { verifyCustomer } from "../middleware/auth.js"; 
import * as AddressController from "../controllers/address/index.js";

const router = Router();

router.post("/add", verifyCustomer, AddressController.addAddress);

router.get("/get", verifyCustomer, AddressController.getAddresses);

router.patch("/default/:addressId", verifyCustomer, AddressController.setDefaultAddress);

router.delete("/delete/:addressId", verifyCustomer, AddressController.deleteAddress);

export default router;
