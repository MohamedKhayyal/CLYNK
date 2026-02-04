const jwt = require("jsonwebtoken");
const { sql } = require("../config/db.Config");
const catchAsync = require("../utilts/catch.Async");
const logger = require("../utilts/logger");
const AppError = require("../utilts/app.Error");

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
    logger.warn("Auth protect: No token provided");
    return next(
      new AppError(
        "You are not logged in. Please log in to access this route.",
        401
      )
    );
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    logger.warn("Auth protect: Invalid or expired token");
    return next(
      new AppError("Invalid or expired token. Please log in again.", 401)
    );
  }

  const result = await sql.query`
    SELECT user_id, email, user_type, is_active, created_at, photo
    FROM dbo.Users
    WHERE user_id = ${decoded.user_id};
  `;

  const user = result.recordset[0];

  if (!user || !user.is_active) {
    logger.warn(`Auth protect: user invalid (${decoded.user_id})`);
    return next(
      new AppError(
        "User belonging to this token no longer exists or is inactive.",
        401
      )
    );
  }

  req.user = user;
  next();
});

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.user_type)) {
      return next(
        new AppError(
          "You do not have permission to perform this action.",
          403
        )
      );
    }
    next();
  };
};
