const responsesStatus = require("./response.Status");
const STATUS_CODES = require("./response.Codes");

const sendSuccess = (
  res,
  data = null,
  message = "Success",
  statusCode = STATUS_CODES.OK
) => {
  return res.status(statusCode).json({
    success: true,
    status: responsesStatus.SUCCESS,
    message,
    ...(data !== null && data !== undefined && { data }),
  });
};

const sendFail = (
  res,
  errors = {},
  message = "Fail",
  statusCode = STATUS_CODES.BAD_REQUEST
) => {
  return res.status(statusCode).json({
    success: false,
    status: responsesStatus.FAIL,
    message,
    ...(Object.keys(errors).length > 0 && { errors }),
  });
};

const sendError = (
  res,
  error,
  message = "Error",
  statusCode = STATUS_CODES.INTERNAL_SERVER_ERROR
) => {
  return res.status(statusCode).json({
    success: false,
    status: responsesStatus.ERROR,
    message,
    error,
  });
};

module.exports = {
  sendSuccess,
  sendFail,
  sendError,
};
