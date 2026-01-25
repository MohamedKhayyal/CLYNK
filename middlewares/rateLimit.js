const rateLimit = require("express-rate-limit");
const AppError = require("../utilts/app.Error");
const logger = require("../utilts/logger");

exports.createRateLimiter = ({ windowMs, max, name }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,

    handler: (req, res, next) => {
      logger.warn(
        `Rate limit exceeded [${name}] | IP: ${req.ip} | User: ${req.user?.user_id || "guest"}`
      );

      next(
        new AppError(
          "Too many requests, please try again later.",
          429
        )
      );
    },
  });
