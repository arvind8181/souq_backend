import Joi from "joi";
import { validateRequest } from "../../middleware/validation.js";

const ProductValidate = {
  createProduct: validateRequest(
    Joi.object({
      productName: Joi.string().trim().required(),
      description: Joi.string().trim().allow(""),
      category: Joi.string().trim().required(),
      subCategory: Joi.string().trim().allow(""),
      price: Joi.number().min(0).required(),
      discount: Joi.number().min(0).optional(),
      quantity: Joi.number().required(),
      productType: Joi.string().valid("1", "2").required(),
      unit: Joi.string()
        .valid(
          "kg",
          "g",
          "piece",
          "L",
          "ml",
          "box",
          "pack",
          "bottle",
          "tablet",
          "capsule"
        )
        .required(),
      stockQuantity: Joi.number().integer().min(0).required(),
      sizes: Joi.alternatives().try(
        Joi.array().items(Joi.string()),
        Joi.string().custom((value, helpers) => {
          try {
            const parsed = JSON.parse(value);
            if (!Array.isArray(parsed)) throw new Error();
            return parsed;
          } catch {
            return helpers.error("any.invalid");
          }
        })
      ),

      highlight: Joi.string().allow(""), // HTML allowed
      overview: Joi.string().allow(""),
      specifications: Joi.string().allow(""),
      colors: Joi.optional(),
      isAvailable: Joi.boolean().optional(),
      isCODAvailable: Joi.boolean().optional(),
      tags: Joi.alternatives().try(
        Joi.array().items(Joi.string()),
        Joi.string().custom((value, helpers) => {
          try {
            const parsed = JSON.parse(value);
            if (
              !Array.isArray(parsed) ||
              parsed.some((tag) => typeof tag !== "string")
            ) {
              throw new Error();
            }
            return parsed;
          } catch {
            return helpers.error("any.invalid");
          }
        }, "JSON string to array parser")
      ),
      dimensions: Joi.object({
        length: Joi.number().min(0).default(0),
        width: Joi.number().min(0).default(0),
        height: Joi.number().min(0).default(0),
        unit: Joi.string().valid("cm", "m", "in", "ft").default("cm"),
      }).required(),
    })
  ),
};

export default ProductValidate;
