import { Router } from "express";
import { verifyAdmin } from "../middleware/auth.js";
import * as faqController from "../controllers/faq/index.js"
const router = Router();

/*************************** POST Routes ***************************/
router.post(`/createFaq`, verifyAdmin, faqController.add);
/****************************** END ********************************/


/*************************** PATCH Routes ***************************/
router.patch(`/updateFaq/:id`, verifyAdmin, faqController.update);
/****************************** END ********************************/


/*************************** GET Routes ***************************/
router.get(`/getFaq`, faqController.get);
/****************************** END ********************************/


/*************************** DELETE Routes ***************************/
router.delete(`/deleteFaq/:id`, verifyAdmin, faqController.remove);
/****************************** END ********************************/



export default router;