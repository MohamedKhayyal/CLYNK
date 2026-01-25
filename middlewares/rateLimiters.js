const { createRateLimiter } = require("./rateLimit");

exports.globalLimiter = createRateLimiter({
  name: "global",
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
});

exports.authLimiter = createRateLimiter({
  name: "auth",
  windowMs: 15 * 60 * 1000,
  max: 10,
});

exports.writeLimiter = createRateLimiter({
  name: "write",
  windowMs: 10 * 60 * 1000,
  max: 20,
});

exports.adminLimiter = createRateLimiter({
  name: "admin",
  windowMs: Number(process.env.ADMIN_RATE_LIMIT_WINDOW_MS),
  max: Number(process.env.ADMIN_RATE_LIMIT_MAX),
});
