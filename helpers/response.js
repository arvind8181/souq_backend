import { ResponseMessage } from "../utils/constant.js";
// const { logInfo, logError } = require("../utils/logger");

const JsonRes = {
  success: (res, data, message = ResponseMessage.SUCCESS) => {
    // logInfo(res.request, 200, message, data);
    return res.status(200).json({
      statusCode: 200,
      status: true,
      data,
      message,
    });
  },

  failed: (res, error, message = ResponseMessage.FAILED) => {
    // logError(res.request, 200, message, error);
    return res.status(200).json({
      statusCode: 200,
      status: false,
      error,
      message,
    });
  },

  dataCreated: (res, data, message = ResponseMessage.DATA_CREATED) => {
    // logInfo(res.request, 201, message, data);
    return res.status(201).json({
      statusCode: 201,
      status: true,
      data,
      message,
    });
  },

  badRequest: (res, error = null, message = ResponseMessage.BAD_REQUEST) => {
    // logError(res.request, 400, message, error);
    return res.status(400).json({
      statusCode: 400,
      status: false,
      message,
      error,
    });
  },

  serverError: (res, error = null, message = ResponseMessage.SERVER_ERROR) => {
    // logError(res.request, 500, message, error);
    return res.status(500).json({
      statusCode: 500,
      status: false,
      message,
      error,
    });
  },

  unauthorized: (res, error = null, message = ResponseMessage.UNAUTHORIZED) => {
    // logError(res.request, 401, message, error);
    return res.status(401).json({
      statusCode: 401,
      status: false,
      message,
      error,
    });
  },

  conflict: (res, error = null, message = ResponseMessage.CONFLICT) => {
    // logError(res.request, 409, message, error);
    return res.status(409).json({
      statusCode: 409,
      status: false,
      message,
      error,
    });
  },

  forbidden: (res, error = null, message = ResponseMessage.FORBIDDEN) => {
    // logError(res.request, 403, message, error);
    return res.status(403).json({
      statusCode: 403,
      status: false,
      message,
      error,
    });
  },

  notFound: (res, error = null, message = ResponseMessage.DATA_NOT_FOUND) => {
    // logError(res.request, 404, message, error);
    return res.status(404).json({
      statusCode: 404,
      status: false,
      message,
      error,
    });
  },

  notAllowed: (res, error = null, message = ResponseMessage.ACCESS_DENIED) => {
    // logError(res.request, 405, message, error);
    return res.status(405).json({
      statusCode: 405,
      status: false,
      message,
      error,
    });
  },
};

export default JsonRes;
