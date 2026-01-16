import Joi from "joi";
import { validateRequest } from "../../middleware/validation.js";

const PromotionValidate = {
  createPromotion: validateRequest(
    Joi.object({
      title: Joi.string().trim().required(),
      description: Joi.string().allow("").optional(),
      discountValue: Joi.number().required(),
      type: Joi.string().valid("promotion", "flash-sale", "bundle").required(),
      paidFlag: Joi.string()
        .valid("urgent", "featured")
        .optional()
        .allow(null)
        .empty(""),
      discountType: Joi.string().valid("Fixed", "Percentage").required(),
      scopeType: Joi.string().valid("product", "category").required(),
      promotionCode: Joi.when("type", {
        is: "promotion",
        then: Joi.string().trim().uppercase().required(),
        otherwise: Joi.string().trim().uppercase().optional().allow(""),
      }),
      productIds: Joi.when("scopeType", {
        is: "product",
        then: Joi.array()
          .items(Joi.string().hex().length(24))
          .min(1)
          .required()
          .messages({
            "any.required": "productIds is required when scopeType is product",
            "array.min": "At least one product is required",
          }),
        otherwise: Joi.forbidden(),
      }),

      categoryIds: Joi.when("scopeType", {
        is: "category",
        then: Joi.array()
          .items(Joi.string().hex().length(24))
          .min(1)
          .required()
          .messages({
            "any.required":
              "categoryIds is required when scopeType is category",
            "array.min": "At least one category is required",
          }),
        otherwise: Joi.forbidden(),
      }),   

      startDate: Joi.date().iso().optional(), 
      endDate: Joi.date()
        .allow(null) // ✅ allow null values
        .when("type", {
          is: (val) => val !== "flash-sale",
          then: Joi.date().required().min(Joi.ref("startDate")).messages({
            "any.required": "End Date is required",
            "date.min": "End Date cannot be before Start Date",
          }),
          otherwise: Joi.date().optional().allow(null),
        }),
      hours: Joi.number()
        .min(1)
        .max(24)
        .allow(null, "") // ✅ allow null or empty string when not flash-sale
        .when("type", {
          is: "flash-sale",
          then: Joi.number().min(1).max(24).required().messages({
            "any.required": "Hours is required",
            "number.min": "Hours must be at least 1",
            "number.max": "Hours cannot exceed 24",
          }),
          otherwise: Joi.number().optional().allow(null, ""),
        }),
    })
  ),
};

export default PromotionValidate;
