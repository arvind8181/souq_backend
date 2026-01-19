import Joi from "joi";
import { validateRequest } from "../../middleware/validation.js";

const BoostValidate = {
  createBoost: validateRequest(
    Joi.object({
      boost_type: Joi.string()
        .valid("featured", "top_of_list", "highlight")
        .required(),

      scope_type: Joi.string()
        .valid("product", "category")
        .required(),

      scope_ids: Joi.array()
        .items(Joi.string().hex().length(24))
        .min(1)
        .required(),

      duration: Joi.object({
        value: Joi.number().min(1).required(),
        unit: Joi.string()
          .valid("day", "hour") 
          .required(),
      }).required(),

      price: Joi.number().min(0).required(),

      start_date: Joi.date().iso().required(),
    })
  ),
};

export default BoostValidate;
