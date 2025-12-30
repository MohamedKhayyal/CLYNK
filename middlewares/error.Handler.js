const STATUS_CODES = require("../utilts/response.Codes");
const responsesStatus = require("../utilts/response.Status");
const AppError = require("../utilts/app.Error");
const ERROR_CODES = require("../utilts/error.Codes");
const logger = require("../utilts/logger");

const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR;
  err.status = err.status || responsesStatus.ERROR;
  err.errorCode = err.errorCode || ERROR_CODES.SERVER_ERROR;

  if (err.name === "CastError") {
    const message = `Invalid ${err.path}: ${err.value}.`;
    err = new AppError(
      message,
      STATUS_CODES.BAD_REQUEST,
      ERROR_CODES.CAST_ERROR
    );
  }

  if (err.code === 11000) {
    const value = Object.values(err.keyValue).join(", ");
    const message = `Duplicate field value: "${value}". Please use another value!`;
    err = new AppError(
      message,
      STATUS_CODES.BAD_REQUEST,
      ERROR_CODES.DUPLICATE_KEY
    );
  }

  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((el) => el.message);
    const details = {};

    Object.keys(err.errors).forEach((field) => {
      details[field] = err.errors[field].message;
    });

    const message = `Invalid input data. ${errors.join(". ")}`;
    err = new AppError(
      message,
      STATUS_CODES.BAD_REQUEST,
      ERROR_CODES.VALIDATION_ERROR,
      details
    );
  }

  if (err.name === "JsonWebTokenError") {
    err = new AppError(
      "Invalid token. Please log in again!",
      STATUS_CODES.UNAUTHORIZED,
      ERROR_CODES.JWT_INVALID
    );
  }

  if (err.name === "TokenExpiredError") {
    err = new AppError(
      "Your token has expired! Please log in again.",
      STATUS_CODES.UNAUTHORIZED,
      ERROR_CODES.JWT_EXPIRED
    );
  }

  if (err.name === "MulterError") {
    err = new AppError(
      err.message || "File upload error",
      STATUS_CODES.BAD_REQUEST,
      ERROR_CODES.UPLOAD_ERROR
    );
  }
  logger.error(`${req.method} ${req.originalUrl} | ${err.message}`);

  if (err.stack) {
    logger.error(err.stack);
  }

  const responsePayload = {
    success: false,
    status: err.status,
    message: err.message,
    errorCode: err.errorCode || ERROR_CODES.SERVER_ERROR,
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  };

  if (err.details) {
    responsePayload.errors = err.details;
  }

  if (process.env.NODE_ENV === "development") {
    responsePayload.stack = err.stack;
    responsePayload.statusCode = err.statusCode;
  }

  res.status(err.statusCode).json(responsePayload);
};

module.exports = globalErrorHandler;
