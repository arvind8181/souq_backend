import JsonRes from "../helpers/response.js";
import { ResponseMessage } from "../utils/constant.js";

export const validateRequest = (schema, paramType = "body") => {
  return (req, res, next) => {
    try {
      const params =
        paramType === "body"
          ? req.body
          : paramType === "params"
          ? req.params
          : req.query;

      const { value, error } = schema.validate(params);
      if (error) {
        JsonRes.badRequest(res, error, error.details[0].message);
        return;
      }
      next();
    } catch (error) {
      JsonRes.badRequest(res, error, ResponseMessage.BAD_REQUEST);
    }
  };
};
