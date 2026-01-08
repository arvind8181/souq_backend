import Joi from "joi";
import { validateRequest } from "../../middleware/validation.js";
import { CATEGORY_OPTIONS } from "../../utils/constant.js";
const VenderDetailValidate = {
  createVender: validateRequest(
    Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string()
        .pattern(new RegExp("^(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*]).{6,}$"))
        .required()
        .messages({
          "string.pattern.base":
            "Password must be at least 6 characters long, contain one uppercase letter, one number, and one special character.",
        }),
    })
  ),
  updateVendorProfile: validateRequest(
    Joi.object({
      businessName: Joi.string().trim().required(),
      ownerName: Joi.string().trim().required(),
      commercialRegNo: Joi.string().trim().allow(null, ""),
      vatOrTaxId: Joi.string().trim().allow(null, ""),
      nationalIdNumber: Joi.string().trim().required(),
      businessPhone: Joi.string().trim().required(),
      whatsappNumber: Joi.string().trim().allow(null, ""),

      location: Joi.alternatives()
        .try(
          Joi.object({
            type: Joi.string().valid("Point").required(),
            coordinates: Joi.array()
              .ordered(
                Joi.number().min(-180).max(180).required(), // longitude
                Joi.number().min(-90).max(90).required() // latitude
              )
              .length(2)
              .required(),
          }),
          Joi.string().custom((value, helpers) => {
            try {
              const parsed = JSON.parse(value);
              if (
                parsed.type !== "Point" ||
                !Array.isArray(parsed.coordinates) ||
                parsed.coordinates.length !== 2 ||
                parsed.coordinates.some((n) => typeof n !== "number")
              ) {
                throw new Error();
              }
              return parsed;
            } catch {
              return helpers.error("any.invalid");
            }
          }, "Custom location parser")
        )
        .required(),

      address: Joi.alternatives()
        .try(
          Joi.object({
            street: Joi.string().required(),
            city: Joi.string().required(),
            state: Joi.string().allow("", null),
            country: Joi.string().required(),
          }),
          Joi.string().custom((value, helpers) => {
            try {
              const parsed = JSON.parse(value);
              if (
                typeof parsed.street !== "string" ||
                typeof parsed.city !== "string" ||
                typeof parsed.country !== "string"
              ) {
                throw new Error();
              }
              return parsed;
            } catch {
              return helpers.error("any.invalid");
            }
          }, "Custom address parser")
        )
        .required(),

      category: Joi.alternatives()
        .try(
          Joi.array()
            .items(Joi.string().valid(...CATEGORY_OPTIONS))
            .min(1),
          Joi.string().custom((value, helpers) => {
            try {
              const parsed = JSON.parse(value);
              if (!Array.isArray(parsed) || parsed.length === 0)
                throw new Error();
              for (const item of parsed) {
                if (!CATEGORY_OPTIONS.includes(item)) throw new Error();
              }
              return parsed;
            } catch {
              return helpers.error("any.invalid");
            }
          }, "Custom category parser")
        )
        .required(),

      bankOrMobilePayInfo: Joi.string().allow(null, ""),
      businessLogo: Joi.string().uri().allow(null, ""),
      // Remove deliveryHours OR handle it in controller
    })
  ),
  createProduct: validateRequest(
    Joi.object({
      productName: Joi.string().trim().required(),
      description: Joi.string().trim().allow(""),
      category: Joi.string().trim().required(),
      subCategory: Joi.string().trim().allow(""),
      price: Joi.number().min(0).required(),
      discountPrice: Joi.number().min(0).optional(),
      unit: Joi.string().required(),
      stockQuantity: Joi.number().integer().min(0).required(),
      images: Joi.array().items(Joi.string().uri()).optional(),
      videoURL: Joi.string().uri().allow("").optional(),
      deliveryTimeEstimate: Joi.string().allow("").optional(),
      isAvailable: Joi.boolean().optional(),
      isCODAvailable: Joi.boolean().optional(),
      tags: Joi.array().items(Joi.string()).optional(),
      deleted: Joi.boolean().optional(),
    })
  ),
};

export default VenderDetailValidate;
