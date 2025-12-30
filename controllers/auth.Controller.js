const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sql } = require("../config/db.Config");
const logger = require("../utilts/logger");
const AppError = require("../utilts/app.Error");
const catchAsync = require("../utilts/catch.Async");

const ALLOWED_SIGNUP_ROLES = ["patient", "doctor", "staff"];

const EMAIL_REGEX = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;

const signToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const sendTokenCookie = (res, token) => {
  res.cookie("jwt", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    logger.warn("Signup failed: missing required fields");
    return next(new AppError("Name, email and password are required", 400));
  }

  if (!EMAIL_REGEX.test(email)) {
    logger.warn(`Signup failed: invalid email format (${email})`);
    return next(new AppError("Please provide a valid email address", 400));
  }

  const userRole = ALLOWED_SIGNUP_ROLES.includes(role) ? role : "patient";

  const existingUser = await sql.query`
    SELECT id FROM Users WHERE email = ${email};
  `;

  if (existingUser.recordset.length > 0) {
    logger.warn(`Signup failed: email already exists (${email})`);
    return next(new AppError("Email already exists", 409));
  }

  // hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  const result = await sql.query`
    INSERT INTO Users (name, email, password, role)
    OUTPUT INSERTED.id, INSERTED.name, INSERTED.email, INSERTED.role
    VALUES (${name}, ${email}, ${hashedPassword}, ${userRole});
  `;

  const user = result.recordset[0];

  const token = signToken({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  });

  sendTokenCookie(res, token);

  logger.info(`User signed up: ${email} (${userRole})`);

  res.status(201).json({
    status: "success",
    token,
  });
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    logger.warn("Login failed: missing credentials");
    return next(new AppError("Email and password are required", 400));
  }

  const result = await sql.query`
    SELECT id, name, email, password, role
    FROM Users
    WHERE email = ${email};
  `;

  const user = result.recordset[0];

  if (!user) {
    logger.warn(`Login failed: user not found (${email})`);
    return next(new AppError("Invalid email or password", 401));
  }

  const isCorrect = await bcrypt.compare(password, user.password);

  if (!isCorrect) {
    logger.warn(`Login failed: wrong password (${email})`);
    return next(new AppError("Invalid email or password", 401));
  }

  const token = signToken({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  });

  sendTokenCookie(res, token);

  logger.info(`User logged in: ${email}`);

  res.status(200).json({
    status: "success",
    token,
  });
});

exports.createAdmin = catchAsync(async (req, res, next) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return next(new AppError("Name, email and password are required", 400));
  }

  if (!EMAIL_REGEX.test(email)) {
    return next(new AppError("Please provide a valid email address", 400));
  }

  const existingUser = await sql.query`
    SELECT id FROM Users WHERE email = ${email};
  `;

  if (existingUser.recordset.length > 0) {
    return next(new AppError("Email already exists", 409));
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const result = await sql.query`
    INSERT INTO Users (name, email, password, role)
    OUTPUT INSERTED.id, INSERTED.name, INSERTED.email, INSERTED.role
    VALUES (${name}, ${email}, ${hashedPassword}, 'admin');
  `;

  const admin = result.recordset[0];

  logger.warn(`ADMIN CREATED: ${email}`);

  res.status(201).json({
    status: "success",
    data: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    },
  });
});
