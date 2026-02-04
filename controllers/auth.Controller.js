const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sql } = require("../config/db.Config");
const logger = require("../utilts/logger");
const AppError = require("../utilts/app.Error");
const catchAsync = require("../utilts/catch.Async");
const { createNotification } = require("../utilts/notification");

const ALLOWED_SIGNUP_ROLES = ["patient", "doctor", "staff"];
const EMAIL_REGEX = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;

const signAccessToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const signRefreshToken = (payload) =>
  jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  });

const sendAccessCookie = (res, token) => {
  res.cookie("jwt", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge:
      Number(process.env.JWT_COOKIE_EXPIRES_IN || 7) * 24 * 60 * 60 * 1000,
  });
};

const sendRefreshCookie = (res, refreshToken) => {
  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const { email, password, user_type, profile } = req.body;

  if (!email || !password) {
    return next(new AppError("Email and password are required", 400));
  }

  if (!EMAIL_REGEX.test(email)) {
    return next(new AppError("Invalid email format", 400));
  }

  if (!ALLOWED_SIGNUP_ROLES.includes(user_type)) {
    return next(new AppError("Invalid user type", 400));
  }

  if (!profile || typeof profile !== "object") {
    return next(new AppError("Profile data is required", 400));
  }

  const exists = await sql.query`
    SELECT user_id FROM dbo.Users WHERE email = ${email};
  `;
  if (exists.recordset.length) {
    return next(new AppError("Email already exists", 409));
  }

  const hashedPassword = await bcrypt.hash(
    password,
    Number(process.env.BCRYPT_SALT_ROUNDS) || 12,
  );

  const transaction = new sql.Transaction();
  await transaction.begin();

  try {
    const userResult = await transaction.request().query`
      INSERT INTO dbo.Users (email, password, user_type)
      OUTPUT INSERTED.user_id, INSERTED.user_type
      VALUES (${email}, ${hashedPassword}, ${user_type});
    `;

    const user = userResult.recordset[0];

    if (user_type === "patient") {
      const { full_name, date_of_birth, gender, phone, blood_type } = profile;

      if (!full_name) {
        throw new AppError("Patient full_name is required", 400);
      }

      await transaction.request().query`
        INSERT INTO dbo.Patients
          (user_id, full_name, date_of_birth, gender, phone, blood_type)
        VALUES
          (${user.user_id},
           ${full_name},
           ${date_of_birth || null},
           ${gender || null},
           ${phone || null},
           ${blood_type || null});
      `;
    } else if (user_type === "doctor") {
      const { full_name, license_number, gender, years_of_experience, bio } =
        profile;

      if (!full_name || !license_number) {
        throw new AppError(
          "Doctor full_name and license_number are required",
          400,
        );
      }

      await transaction.request().query`
        INSERT INTO dbo.Doctors
          (user_id, full_name, license_number, gender, years_of_experience, bio)
        VALUES
          (${user.user_id},
           ${full_name},
           ${license_number},
           ${gender || null},
           ${years_of_experience || null},
           ${bio || null});
      `;
      const adminsResult = await sql.query`
         SELECT user_id FROM dbo.Admins;
       `;

      for (const admin of adminsResult.recordset) {
        await createNotification({
          user_id: admin.user_id,
          title: `New Doctor Pending Approval: ${full_name}`,
          message: `A new doctor "${full_name}" has been created and is waiting for approval.`,
        });
      }
    } else if (user_type === "staff") {
      const { full_name, clinic_id, role_title } = profile;

      if (!full_name || !clinic_id) {
        throw new AppError("Staff full_name and clinic_id are required", 400);
      }

      const clinicResult = await transaction.request().query`
    SELECT clinic_id, owner_user_id
    FROM dbo.Clinics
    WHERE clinic_id = ${clinic_id}
      AND status = 'approved';
  `;

      if (!clinicResult.recordset.length) {
        throw new AppError("Clinic not found or not approved", 400);
      }

      const clinic = clinicResult.recordset[0];

      await transaction.request().query`
    INSERT INTO dbo.Staff
      (user_id, clinic_id, full_name, role_title, is_verified)
    VALUES
      (${user.user_id},
       ${clinic_id},
       ${full_name},
       ${role_title || null},
       0);
  `;

      await createNotification({
        user_id: clinic.owner_user_id,
        title: "New Staff Request 👤",
        message: `A new staff member (${full_name}) is waiting for verification.`,
      });
    }

    await transaction.commit();

    const accessToken = signAccessToken({
      user_id: user.user_id,
      role: user.user_type,
    });

    const refreshToken = signRefreshToken({
      user_id: user.user_id,
    });

    sendAccessCookie(res, accessToken);
    sendRefreshCookie(res, refreshToken);

    res.status(201).json({
      status: "success",
      user: {
        user_id: user.user_id,
        email,
        role: user.user_type,
        photo: null,
      },
      accessToken,
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError("Email and password are required", 400));
  }

  const result = await sql.query`
    SELECT user_id, email, password, photo, user_type, is_active
    FROM dbo.Users
    WHERE email = ${email} AND is_active = 1;
  `;

  const user = result.recordset[0];
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
      FROM dbo.Patients
      WHERE user_id = ${user.user_id};
    `;
    profile = r.recordset[0] || null;
  } else if (user.user_type === "doctor") {
    const r = await sql.query`
      SELECT
        full_name,
        gender,
        years_of_experience,
        bio,
        consultation_price,
        work_from,
        work_to,
        is_verified
      FROM dbo.Doctors
      WHERE user_id = ${user.user_id};
    `;
    profile = r.recordset[0] || null;
  } else if (user.user_type === "staff") {
    const r = await sql.query`
      SELECT
        full_name,
        clinic_id,
        role_title,
        is_verified
      FROM dbo.Staff
      WHERE user_id = ${user.user_id};
    `;
    profile = r.recordset[0] || null;
  } else if (user.user_type === "admin") {
    const r = await sql.query`
      SELECT position_title
      FROM dbo.Admins
      WHERE user_id = ${user.user_id};
    `;
    profile = r.recordset[0] || null;
  }

  const accessToken = signAccessToken({
    user_id: user.user_id,
    role: user.user_type,
  });

  const refreshToken = signRefreshToken({
    user_id: user.user_id,
  });

  sendAccessCookie(res, accessToken);
  sendRefreshCookie(res, refreshToken);

  res.status(200).json({
    status: "success",
    user: {
      user_id: user.user_id,
      email: user.email,
      photo: user.photo,
      role: user.user_type,
      profile,
    },
    accessToken,
  });
});

exports.refreshToken = catchAsync(async (req, res, next) => {
  const refreshToken = req.cookies.refresh_token;

  if (!refreshToken) {
    return next(new AppError("Refresh token missing", 401));
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (err) {
    return next(new AppError("Invalid refresh token", 401));
  }

  const userResult = await sql.query`
    SELECT user_id, user_type, is_active
    FROM dbo.Users
    WHERE user_id = ${decoded.user_id} AND is_active = 1;
  `;

  const user = userResult.recordset[0];
  if (!user) {
    return next(new AppError("User not found", 401));
  }

  const newAccessToken = signAccessToken({
    user_id: user.user_id,
    role: user.user_type,
  });

  sendAccessCookie(res, newAccessToken);

  res.status(200).json({
    status: "success",
    accessToken: newAccessToken,
  });
});

exports.logout = (req, res) => {
  res.cookie("jwt", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    expires: new Date(0),
  });

  res.cookie("refresh_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    expires: new Date(0),
  });

  res.status(200).json({
    status: "success",
    message: "Logged out successfully",
  });
};
