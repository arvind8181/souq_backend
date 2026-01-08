import Joi from "joi";
import { validateRequest } from "../../middleware/validation.js";


const CategoryValidate = {
    createCategory: validateRequest(
        Joi.object({
            category: Joi.string().trim().required(),
            subCategory: Joi.string().trim().required(),
        })
    ),
};

export default CategoryValidate;