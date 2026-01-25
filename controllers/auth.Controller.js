const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sql } = require("../config/db.Config");
const logger = require("../utilts/logger");
const AppError = require("../utilts/app.Error");
const catchAsync = require("../utilts/catch.Async");

const ALLOWED_SIGNUP_ROLES = ["patient", "doctor"];

const EMAIL_REGEX = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;

const signToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const sendTokenCookie = (res, token) => {
  res.cookie("jwt", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge:
      Number(process.env.JWT_COOKIE_EXPIRES_IN || 7) * 24 * 60 * 60 * 1000,
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const { email, password, user_type, profile } = req.body;

  logger.info(`Signup attempt: ${email}`);

  if (!email || !password) {
    return next(new AppError("Email and password are required", 400));
  }

  if (!EMAIL_REGEX.test(email)) {
    return next(new AppError("Invalid email format", 400));
  }

  const role = ALLOWED_SIGNUP_ROLES.includes(user_type) ? user_type : "patient";

  const existingUser = await sql.query`
    SELECT user_id FROM dbo.Users WHERE email = ${email};
  `;

  if (existingUser.recordset.length > 0) {
    return next(new AppError("Email already exists", 409));
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const transaction = new sql.Transaction();
  await transaction.begin();

  try {
    const userResult = await transaction.request().query(`
      INSERT INTO dbo.Users (email, password, user_type)
      OUTPUT INSERTED.user_id, INSERTED.user_type, INSERTED.is_active
      VALUES ('${email}', '${hashedPassword}', '${role}');
    `);

    const user = userResult.recordset[0];

    if (role === "patient") {
      const { full_name, date_of_birth, gender, phone, blood_type } = profile;

      if (!full_name) {
        throw new AppError("Patient full_name is required", 400);
      }

      await transaction.request().query(`
        INSERT INTO dbo.Patients
          (user_id, full_name, date_of_birth, gender, phone, blood_type)
        VALUES
          (${user.user_id},
           '${full_name}',
           ${date_of_birth ? `'${date_of_birth}'` : "NULL"},
           ${gender ? `'${gender}'` : "NULL"},
           ${phone ? `'${phone}'` : "NULL"},
           ${blood_type ? `'${blood_type}'` : "NULL"});
      `);
    }

    if (role === "doctor") {
      const { full_name, license_number, gender, years_of_experience, bio } =
        profile;

      if (!full_name || !license_number) {
        throw new AppError(
          "Doctor full_name and license_number are required",
          400,
        );
      }

      await transaction.request().query(`
        INSERT INTO dbo.Doctors
          (user_id, full_name, license_number, gender, years_of_experience, bio)
        VALUES
          (${user.user_id},
           '${full_name}',
           '${license_number}',
           ${gender ? `'${gender}'` : "NULL"},
           ${years_of_experience ?? "NULL"},
           ${bio ? `'${bio}'` : "NULL"});
      `);
    }

    await transaction.commit();

    const token = signToken({
      user_id: user.user_id,
      role: user.user_type,
    });

    sendTokenCookie(res, token);

    logger.info(`Signup success: ${email} (${role})`);

    res.status(201).json({
      status: "success",
      user: {
        user_id: user.user_id,
        email,
        role: user.user_type,
        is_active: user.is_active,
      },
    });
  } catch (err) {
    await transaction.rollback();
    logger.error(`Signup failed: ${err.message}`);
    next(err);
  }
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  logger.info(`Login attempt: ${email}`);

  if (!email || !password) {
    return next(new AppError("Email and password are required", 400));
  }

  const userResult = await sql.query`
    SELECT user_id, password, user_type, is_active
    FROM dbo.Users
    WHERE email = ${email} AND is_active = 1;
  `;

  const user = userResult.recordset[0];

  if (!user) {
    return next(new AppError("Invalid email or password", 401));
  }

  const isCorrect = await bcrypt.compare(password, user.password);

  if (!isCorrect) {
    return next(new AppError("Invalid email or password", 401));
  }

  let profile = null;

  if (user.user_type === "patient") {
    const r = await sql.query`
      SELECT full_name, date_of_birth, gender, phone, blood_type
      FROM dbo.Patients WHERE user_id = ${user.user_id};
    `;
    profile = r.recordset[0] || null;
  }

  if (user.user_type === "doctor") {
    const r = await sql.query`
      SELECT full_name, license_number, gender, years_of_experience, bio, is_verified
      FROM dbo.Doctors WHERE user_id = ${user.user_id};
    `;
    profile = r.recordset[0] || null;
  }

  if (user.user_type === "staff") {
    const r = await sql.query`
      SELECT full_name, clinic_id, role_title
      FROM dbo.Staff WHERE user_id = ${user.user_id};
    `;
    profile = r.recordset[0] || null;
  }

  if (user.user_type === "admin") {
    const r = await sql.query`
      SELECT position_title
      FROM dbo.Admins WHERE user_id = ${user.user_id};
    `;
    profile = r.recordset[0] || null;
  }

  const token = signToken({
    user_id: user.user_id,
    role: user.user_type,
  });

  sendTokenCookie(res, token);

  logger.info(`Login success: ${email} (${user.user_type})`);

  res.status(200).json({
    status: "success",
    user: {
      user_id: user.user_id,
      email,
      role: user.user_type,
      is_active: user.is_active,
      profile,
      token
    },
  });
});

exports.createAdmin = catchAsync(async (req, res, next) => {
  const { email, password, position_title } = req.body;

  logger.warn(`Admin creation attempt: ${email}`);

  if (!email || !password) {
    return next(new AppError("Email and password are required", 400));
  }

  if (!EMAIL_REGEX.test(email)) {
    return next(new AppError("Invalid email format", 400));
  }

  const exists = await sql.query`
    SELECT user_id FROM dbo.Users WHERE email = ${email};
  `;

  if (exists.recordset.length) {
    return next(new AppError("Email already exists", 409));
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const transaction = new sql.Transaction();
  await transaction.begin();

  try {
    const userResult = await transaction.request().query(`
      INSERT INTO dbo.Users (email, password, user_type)
      OUTPUT INSERTED.user_id
      VALUES ('${email}', '${hashedPassword}', 'admin');
    `);

    const userId = userResult.recordset[0].user_id;

    await transaction.request().query(`
      INSERT INTO dbo.Admins (user_id, position_title)
      VALUES (${userId}, ${position_title ? `'${position_title}'` : "NULL"});
    `);

    await transaction.commit();

    logger.warn(`ADMIN CREATED: ${email}`);

    res.status(201).json({
      status: "success",
      user: {
        user_id: userId,
        email,
        role: "admin",
      },
    });
  } catch (err) {
    await transaction.rollback();
    logger.error(`Create admin failed: ${err.message}`);
    next(err);
  }
});

exports.logout = (req, res) => {
  res.cookie("jwt", "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    expires: new Date(0),
  });

  res.status(200).json({
    status: "success",
    message: "Logged out successfully",
  });
};
