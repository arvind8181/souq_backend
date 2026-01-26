import { Router } from "express";
import UserValidate from "../controllers/user/validation.js";
import * as MU from "../middleware/login.js";
import * as UserController from "../controllers/user/index.js";
import * as VenderController from "../controllers/vendorDetails/index.js";
import { login } from "../middleware/login.js";
import { profileImageUpload } from "../middleware/profileImageUpload.js";
import {driverImageUpload} from "../middleware/driverImageUpload.js";

import {
  verifyAdmin,
  verifyVendor,
  verifyCustomer,
  verifyDriver,
} from "../middleware/auth.js";
import multer from "multer";
const storage = multer.memoryStorage();
const upload = multer({ storage });
const router = Router();

/*************************** Post Routes ***************************/
router.post(
  `/create`,
  UserValidate.createNewAccount,
  UserController.createAccount
);
router.post(
  "/admin/create-user",
  verifyAdmin,
  UserValidate.createNewAccount,
  UserController.createAccount
);
router.get(
  '/admin/permissions',
  verifyAdmin,
  UserController.getPermissions
)
router.get(
  '/admin/sub-admins',
  verifyAdmin,
  UserController.getSubAdmins
)
router.patch(
  '/admin/sub-admin/:id',
  verifyAdmin,
  UserController.updateSubAdmin
)
router.delete(
  '/admin/sub-admin/:id',
  verifyAdmin,
  UserController.deleteSubAdmin
)

router.post(
  `/forgot/password`,
  MU.forgotPassword,
  UserController.forgotPasswordController
);
router.post(
  `/verify/password-otp`,
  UserValidate.verfiyopt,
  UserController.verifyOtp
);
router.post(
  `/reset/password`,
  UserValidate.resetPassword,
  UserController.resetPasswordConfirm
);
router.post("/changePassword", UserController.changePassword);
router.post(`/resend/otp`, VenderController.resendOtp);
router.post(`/verify/otp`, UserValidate.verfiyopt, VenderController.verifyOtp);
router.post(`/socialSignup`, UserController.socialSignUp);
router.post(`/socialLogin`, UserController.socialLogin);
router.post("/customer/notifications/toggle", verifyCustomer,UserController.toggleNotification);
router.post("/driver/notifications/toggle", verifyDriver, UserController.toggleNotification);
/******************************* PATCH Routes *******************************/

router.patch(
  `/updateCustomer/profile`,
  verifyCustomer,profileImageUpload,
  UserController.updateCustomerProfile
);
router.patch(
  `/updateDriver/profile`,
  verifyDriver,
  driverImageUpload,
  UserController.updateDriverProfile
);

/******************************* END *******************************/

/*************************** Get Routes ***************************/
router.post(`/login`, login, UserController.loginController);
router.get(
  `/profile/customer`,
  verifyCustomer,
  UserController.fetchCustomerProfile
);
router.get("/profile/driver", verifyDriver, UserController.fetchDriverProfile);

/******************************* END ******************************/

/*************************** DELETE Routes ***************************/

// Delete customer account
router.delete(
  "/account/customer",
  verifyCustomer,
  UserController.deleteAccount
);

// Delete driver account
router.delete(
  "/account/driver",
  verifyDriver,
  UserController.deleteAccount
);

// Delete vendor account
router.delete(
  "/account/vendor",
  verifyVendor,
  UserController.deleteAccount
);

/******************************* END *******************************/



 // Notifications...................
// For customers
router.get(
  "/notifications/customer",
  verifyCustomer,
  UserController.getCustomerNotifications
);

// For drivers
router.get(
  "/notifications/driver",
  verifyDriver,
  UserController.getDriverNotifications
);






export default router;
