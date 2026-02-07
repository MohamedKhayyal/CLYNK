const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sql } = require("../config/db.Config");
const AppError = require("../utilts/app.Error");
const catchAsync = require("../utilts/catch.Async");
const { createNotification } = require("../utilts/notification");

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
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const sendRefreshCookie = (res, token) => {
  res.cookie("refresh_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const { email, password, user_type, profile } = req.body;

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
    const userResult = await transaction.request().query`
      INSERT INTO dbo.Users (email, password, user_type)
      OUTPUT INSERTED.user_id, INSERTED.user_type
      VALUES (${email}, ${hashedPassword}, ${user_type});
    `;

    const user = userResult.recordset[0];

    if (user_type === "patient") {
      const { full_name, date_of_birth, gender, phone, blood_type } = profile;

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
    }

    if (user_type === "doctor") {
      const {
        full_name,
        license_number,
        gender,
        years_of_experience,
        bio,
        specialist,
        work_days,
        location,
      } = profile;

      await transaction.request().query`
        INSERT INTO dbo.Doctors
          (user_id, full_name, license_number, gender,
           years_of_experience, bio, specialist, work_days, location)
        VALUES
          (${user.user_id},
           ${full_name},
           ${license_number},
           ${gender || null},
           ${years_of_experience || null},
           ${bio || null},
           ${specialist},
           ${work_days},
           ${location || null});
      `;

      const admins = await transaction.request().query`
        SELECT user_id FROM dbo.Admins;
      `;

      for (const admin of admins.recordset) {
        await createNotification({
          user_id: admin.user_id,
          title: "New Doctor Pending Approval 👨‍⚕️",
          message: `Doctor "${full_name}" is waiting for verification.`,
        });
      }
    }

    if (user_type === "staff") {
      const { full_name, clinic_id, role_title, specialist } = profile;

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
          (user_id, clinic_id, full_name, role_title, specialist, is_verified)
        VALUES
          (${user.user_id},
           ${clinic_id},
           ${full_name},
           ${role_title},
           ${role_title === "doctor" ? specialist : null},
           0);
      `;

      await createNotification({
        user_id: clinic.owner_user_id,
        title: "New Staff Request 👤",
        message: `Staff "${full_name}" is waiting for verification.`,
      });
    }

    await transaction.commit();

    const accessToken = signAccessToken({
      user_id: user.user_id,
      role: user.user_type,
    });

    const refreshToken = signRefreshToken({ user_id: user.user_id });

    sendAccessCookie(res, accessToken);
    sendRefreshCookie(res, refreshToken);

    res.status(201).json({
      status: "success",
      user: {
        user_id: user.user_id,
        email,
        role: user.user_type,
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

  const result = await sql.query`
    SELECT user_id, email, password, photo, user_type, is_active
    FROM dbo.Users
    WHERE email = ${email} AND is_active = 1;
  `;

  const user = result.recordset[0];
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return next(new AppError("Invalid email or password", 401));
  }

  let profile = null;

  if (user.user_type === "patient") {
    profile = (
      await sql.query`
        SELECT full_name, date_of_birth, gender, phone, blood_type
        FROM dbo.Patients WHERE user_id = ${user.user_id};
      `
    ).recordset[0];
  }

  if (user.user_type === "doctor") {
    profile = (
      await sql.query`
        SELECT full_name, gender, specialist, work_days, location,
               years_of_experience, bio, is_verified
        FROM dbo.Doctors WHERE user_id = ${user.user_id};
      `
    ).recordset[0];
  }

  if (user.user_type === "staff") {
    profile = (
      await sql.query`
        SELECT full_name, clinic_id, role_title, specialist, is_verified
        FROM dbo.Staff WHERE user_id = ${user.user_id};
      `
    ).recordset[0];
  }
  if (user.user_type === "admin") {
    profile = (
      await sql.query`
        SELECT full_name
        FROM dbo.Admins WHERE user_id = ${user.user_id};
      `
    ).recordset[0];
  }

  const accessToken = signAccessToken({
    user_id: user.user_id,
    role: user.user_type,
  });

  const refreshToken = signRefreshToken({ user_id: user.user_id });

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
  const token = req.cookies.refresh_token;
  if (!token) return next(new AppError("Refresh token missing", 401));

  const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

  const user = (
    await sql.query`
      SELECT user_id, user_type
      FROM dbo.Users
      WHERE user_id = ${decoded.user_id} AND is_active = 1;
    `
  ).recordset[0];

  if (!user) return next(new AppError("User not found", 401));

  const accessToken = signAccessToken({
    user_id: user.user_id,
    role: user.user_type,
  });

  sendAccessCookie(res, accessToken);

  res.status(200).json({ status: "success", accessToken });
});

exports.logout = (req, res) => {
  res.cookie("jwt", "", { expires: new Date(0) });
  res.cookie("refresh_token", "", { expires: new Date(0) });

  res.status(200).json({
    status: "success",
    message: "Logged out successfully",
  });
};
