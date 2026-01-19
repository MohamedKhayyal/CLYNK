const jwt = require("jsonwebtoken");
const { sql } = require("../config/db.Config");
const { sendFail } = require("../utilts/response");
const STATUS_CODES = require("../utilts/response.Codes");
const catchAsync = require("../utilts/catch.Async");
const logger = require("../utilts/logger");

exports.protect = catchAsync(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies && req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    logger.warn("Protect failed: no token provided");
    return sendFail(
      res,
      {},
      "You are not logged in. Please log in to access this route.",
      STATUS_CODES.UNAUTHORIZED,
    );
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  const result = await sql.query`
    SELECT user_id, email, user_type, is_active, created_at
    FROM dbo.Users
    WHERE user_id = ${decoded.user_id};
  `;

  const user = result.recordset[0];

  if (!user || !user.is_active) {
    logger.warn(
      `Protect failed: user not found or inactive (${decoded.user_id})`,
    );
    return sendFail(
      res,
      {},
      "User belonging to this token no longer exists or is inactive.",
      STATUS_CODES.UNAUTHORIZED,
    );
  }

  req.user = user;
  next();
});

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.user_type)) {
      return sendFail(
        res,
        {},
        "You do not have permission to perform this action.",
        STATUS_CODES.FORBIDDEN,
      );
    }
    next();
  };
};
