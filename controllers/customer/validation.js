import Joi from "joi";
import { validateRequest } from "../../middleware/validation.js";

const CustomerDetailValidate = {
  createCustomer: validateRequest(
    Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string()
        .pattern(new RegExp("^(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*]).{6,}$"))
        .required()
        .messages({
          "string.pattern.base":
            "Password must be at least 6 characters long, contain one uppercase letter, one number, and one special character.",
        }),
      FullName: Joi.string().trim().required(),
    })
  ),
};

export default CustomerDetailValidate;
