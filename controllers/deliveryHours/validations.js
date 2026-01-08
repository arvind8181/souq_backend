import Joi from "joi";
import { validateRequest } from "../../middleware/validation.js";

/** ISO string with zone offset, e.g. 1970-01-01T09:00:00+05:30 or ...Z */
const isoWithOffset =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?([+-]\d{2}:\d{2}|Z)$/;

const dayEntrySchema = Joi.object({
  day: Joi.string()
    .valid(
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday"
    )
    .required(),

  isDayOff: Joi.boolean().required(),

  openTime: Joi.when("isDayOff", {
    is: false,
    then: Joi.string().pattern(isoWithOffset).required().messages({
      "string.pattern.base":
        "openTime must be an ISO date-time with offset, e.g. 1970-01-01T09:00:00+05:30",
    }),
    otherwise: Joi.string().optional().allow(null, ""),
  }),

  closeTime: Joi.when("isDayOff", {
    is: false,
    then: Joi.string().pattern(isoWithOffset).required().messages({
      "string.pattern.base":
        "closeTime must be an ISO date-time with offset, e.g. 1970-01-01T18:00:00+05:30",
    }),
    otherwise: Joi.string().optional().allow(null, ""),
  }),
});

const VendorDeliveryHourValidate = {
  createOrUpdate: validateRequest(
    Joi.object({
      hours: Joi.array().items(dayEntrySchema).length(7).required().messages({
        "array.length":
          "Exactly 7 delivery-hour entries (one per day) are required.",
      }),
    })
  ),
};

export default VendorDeliveryHourValidate;
