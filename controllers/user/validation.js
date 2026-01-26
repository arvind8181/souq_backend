import Joi from "joi";
import { validateRequest } from "../../middleware/validation.js";
import { ROLES } from "../../utils/constant.js";
import { PERMISSIONS } from "../../utils/constant.js"
// const UserValidate = {
//   createNewAccount: validateRequest(
//     Joi.object({
//       email: Joi.string().email().required().messages({
//         "string.empty": "Email is required",
//         "string.email": "Must be a valid email address",
//       }),
//       password: Joi.string()
//         .min(6)
//         .pattern(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
//         .required()
//         .messages({
//           "string.empty": "Password is required",
//           "string.min": "Password must be at least 6 characters",
//           "string.pattern.base":
//             "Password must contain at least one uppercase letter, one number, and one special character",
//         }),
//       role: Joi.number()
//         .valid(...Object.values(ROLES))
//         .required()
//         .messages({
//           "any.only": `Role must be one of: ${Object.values(ROLES).join(", ")}`,
//           "number.base": "Role must be a number",
//           "any.required": "Role is required",
//         }),
//       fullName: Joi.string().allow("").optional().messages({
//         "string.base": "Full name must be a string",
//       }),
//     })
//   ),
//   verfiyopt: validateRequest(
//     Joi.object({
//       otp: Joi.string().length(6).required().messages({
//         "string.empty": "OTP is required",
//         "string.length": "OTP must be 6 digits",
//       }),
//     })
//   ),
//   resetPassword: validateRequest(
//     Joi.object({
//       newPassword: Joi.string()
//         .min(6)
//         .pattern(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
//         .required()
//         .messages({
//           "string.empty": "Password is required",
//           "string.min": "Password must be at least 6 characters",
//           "string.pattern.base":
//             "Password must contain at least one uppercase letter, one number, and one special character",
//         }),
//     })
//   ),
// };

// export default UserValidate;

const UserValidate = {
  createNewAccount: validateRequest(
    Joi.object({
      email: Joi.string().email().required().messages({
        "string.empty": "Email is required",
        "string.email": "Must be a valid email address",
      }),
      password: Joi.string()
        .min(6)
        .pattern(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .required()
        .messages({
          "string.empty": "Password is required",
          "string.min": "Password must be at least 6 characters",
          "string.pattern.base":
            "Password must contain at least one uppercase letter, one number, and one special character",
        }),
      role: Joi.number()
        .valid(...Object.values(ROLES))
        .required()
        .messages({
          "any.only": `Role must be one of: ${Object.values(ROLES).join(", ")}`,
          "number.base": "Role must be a number",
          "any.required": "Role is required",
        }),
      fullName: Joi.string().allow("").optional().messages({
        "string.base": "Full name must be a string",
      }),
      createdByAdmin: Joi.boolean().optional(),
      permissions: Joi.array()
      .items(Joi.string().valid(...Object.values(PERMISSIONS)))
      .optional(),

    }),
  ),
  verfiyopt: validateRequest(
    Joi.object({
      otp: Joi.string().length(6).required().messages({
        "string.empty": "OTP is required",
        "string.length": "OTP must be 6 digits",
      }),
    }),
  ),
  resetPassword: validateRequest(
    Joi.object({
      newPassword: Joi.string()
        .min(6)
        .pattern(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .required()
        .messages({
          "string.empty": "Password is required",
          "string.min": "Password must be at least 6 characters",
          "string.pattern.base":
            "Password must contain at least one uppercase letter, one number, and one special character",
        }),
    }),
  ),
};

export default UserValidate;
