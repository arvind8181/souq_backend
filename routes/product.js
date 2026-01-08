import { Router } from "express";
import ProductValidate from "../controllers/products/validation.js";
import * as ProductController from "../controllers/products/index.js";
import { verifyAdmin, verifyVendor, verifyCustomer } from "../middleware/auth.js";
import { productImageUpload } from "../middleware/productupload.js";
const router = Router();

/*************************** POST Routes ***************************/
router.post(
  `/create`,
  verifyVendor,
  ProductValidate.createProduct,
  productImageUpload,
  ProductController.createProduct
);
router.post(
  `/update-status/:productId`,
  verifyVendor,
  ProductController.updateProductStatus
);
router.post(
  '/topCategories/type',
  verifyCustomer,
  ProductController.getTopCategoriesByProductType
);
router.post('/recommendedMinutes/products', verifyCustomer, ProductController.getRecommendedProductsForMinutes);

/****************************** END ********************************/




/*************************** PUT Routes ***************************/
router.put(
  `/update/:productId`,
  verifyVendor,
  ProductValidate.createProduct,
  productImageUpload,
  ProductController.updateProduct
);
/****************************** END *******************************/




/*************************** GET Routes ****************************/
router.get(`/`, verifyVendor, ProductController.getProducts);
router.post(`/`, verifyAdmin, ProductController.getProducts);
router.get(`/:productId`, verifyCustomer, ProductController.getProductsById);
router.get('/recommended/products', verifyCustomer, ProductController.getRecommendedProductsForMarketPlace);
router.get('/topDeals/products', verifyCustomer, ProductController.getTopDeals);
router.get('/getAllProducts/minutes', verifyCustomer, ProductController.getAllProductsOfMinutes);
router.get('/getAllProducts/marketPlace', verifyCustomer, ProductController.getAllProductsOfMarketPlace);
/****************************** END *******************************/



/*************************** DELETE Routes ***************************/
router.delete(
  `/delete/:productId`,
  verifyVendor,
  ProductController.deleteProduct
);
/******************************* END *********************************/



export default router;
