import Joi from "joi";
import { validateRequest } from "../../middleware/validation.js";

const objectId = Joi.string().length(24).hex();

const orderCreateSchema = Joi.object({
  paymentMethod: Joi.string().valid("cash", "card", "wallet").required(),
  notes: Joi.string().allow("").optional(),
  type: Joi.number().valid(1, 2).required(),
});
export const OrderValidate = {
  create: validateRequest(orderCreateSchema),
};
export default OrderValidate;
