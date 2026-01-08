import Joi from "joi";
import { validateRequest } from "../../middleware/validation.js";

const AdValidate = {
  createAd: validateRequest(
    Joi.object({
      // Common fields
      title: Joi.string().trim().required(),
      description: Joi.string().allow("", null),
      price: Joi.number().min(0).required(),
      email: Joi.string().email().required(),
      phone: Joi.string().required(),
      location: Joi.string().required(),
      images: Joi.array().items(Joi.string()).optional(),
      category: Joi.string()
        .valid("car", "real_estate", "used_items")
        .required(),

      // Car-specific fields
      make: Joi.string().when("category", {
        is: "car",
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
      model: Joi.string().when("category", {
        is: "car",
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
      year: Joi.number().integer().when("category", {
        is: "car",
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
      mileage: Joi.number().when("category", {
        is: "car",
        then: Joi.optional(),
        otherwise: Joi.optional(),
      }),
      fuelType: Joi.string().when("category", {
        is: "car",
        then: Joi.optional(),
        otherwise: Joi.optional(),
      }),
      kmDriven: Joi.number().when("category", {
        is: "car",
        then: Joi.optional(),
        otherwise: Joi.optional(),
      }),
      BodyType: Joi.string().when("category", {
        is: "car",
        then: Joi.optional(),
        otherwise: Joi.optional(),
      }),
      color: Joi.string().when("category", {
        is: "car",
        then: Joi.optional(),
        otherwise: Joi.optional(),
      }),
      condition: Joi.string().when("category", {
        is: "car",
        then: Joi.optional(),
        otherwise: Joi.optional(),
      }),
      city: Joi.string().when("category", {
        is: "car",
        then: Joi.optional(),
        otherwise: Joi.optional(),
      }),
      sellerType: Joi.string()
        .valid("Dealer", "Individual", "Both")
        .when("category", {
          is: "car",
          then: Joi.optional(),
          otherwise: Joi.optional(),
        }),
      transmission: Joi.string()
        .valid("Automatic", "Manual", "Both")
        .when("category", {
          is: "car",
          then: Joi.optional(),
          otherwise: Joi.optional(),
        }),

      // Real estate-specific fields
      property_type: Joi.string().when("category", {
        is: "real_estate",
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
      purpose: Joi.string()
        .valid("Sale", "Rent")
        .when("category", {
          is: "real_estate",
          then: Joi.required(),
          otherwise: Joi.optional(),
        }),
      bhk: Joi.string()
        .valid("1BHK", "2BHK", "3BHK", "4BHK", "5BHK")
        .when("category", {
          is: "real_estate",
          then: Joi.optional(),
          otherwise: Joi.optional(),
        }),
      bathrooms: Joi.string()
        .valid("1", "2", "3", "4", "5")
        .when("category", {
          is: "real_estate",
          then: Joi.optional(),
          otherwise: Joi.optional(),
        }),
      furnishing: Joi.string()
        .valid("Fully Furnished", "Semi Furnished", "Unfurnished")
        .when("category", {
          is: "real_estate",
          then: Joi.optional(),
          otherwise: Joi.optional(),
        }),
      floorNumber: Joi.string().when("category", {
        is: "real_estate",
        then: Joi.optional(),
        otherwise: Joi.optional(),
      }),
      spaceArea: Joi.number().when("category", {
        is: "real_estate",
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
      buildYear: Joi.number().integer().when("category", {
        is: "real_estate",
        then: Joi.optional(),
        otherwise: Joi.optional(),
      }),
      availability: Joi.string()
        .valid("Ready to Move", "Under Construction")
        .when("category", {
          is: "real_estate",
          then: Joi.optional(),
          otherwise: Joi.optional(),
        }),
      features: Joi.array().items(Joi.string()).when("category", {
        is: "real_estate",
        then: Joi.optional(),
        otherwise: Joi.optional(),
      }),
      sellertype: Joi.string()
        .valid("Dealer", "Individual")
        .when("category", {
          is: "real_estate",
          then: Joi.optional(),
          otherwise: Joi.optional(),
        }),

      // Used items-specific fields
      condition: Joi.string().when("category", {
        is: "used_items",
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
    })
  ),
};

export default AdValidate;
