const rateLimit = require("express-rate-limit");
const AppError = require("../utilts/app.Error");

exports.createRateLimiter = ({ windowMs, max, name }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,

    handler: (req, res, next) => {
      next(new AppError("Too many requests, please try again later.", 429));
    },
  });
