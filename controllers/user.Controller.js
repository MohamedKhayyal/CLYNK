const { sql } = require("../config/db.Config");
const catchAsync = require("../utilts/catch.Async");
const AppError = require("../utilts/app.Error");
const logger = require("../utilts/logger");

exports.getMe = catchAsync(async (req, res, next) => {
  if (!req.user) {
    return next(new AppError("Unauthorized", 401));
  }

  const { user_id, user_type, email, is_active, photo } = req.user;

  let profileQuery;

  if (user_type === "patient") {
    profileQuery = sql.query`
      SELECT
        full_name,
        date_of_birth,
        gender,
        phone,
        blood_type
      FROM dbo.Patients
      WHERE user_id = ${user_id};
    `;
  } else if (user_type === "doctor") {
    profileQuery = sql.query`
      SELECT
        full_name,
        gender,
        years_of_experience,
        bio,
        consultation_price,
        work_from,
        work_to
      FROM dbo.Doctors
      WHERE user_id = ${user_id};
    `;
  } else if (user_type === "staff") {
    profileQuery = sql.query`
      SELECT
        full_name,
        clinic_id,
        role_title,
        is_verified
      FROM dbo.Staff
      WHERE user_id = ${user_id};
    `;
  } else if (user_type === "admin") {
    profileQuery = sql.query`
      SELECT
        position_title
      FROM dbo.Admins
      WHERE user_id = ${user_id};
    `;
  } else {
    return next(new AppError("Invalid user role", 400));
  }

  const profileResult = await profileQuery;
  const profile = profileResult.recordset[0] || null;

  res.status(200).json({
    status: "success",
    user: {
      user_id,
      email,
      role: user_type,
      is_active,
      photo: photo || null,
      profile,
    },
  });
});

exports.updateMe = catchAsync(async (req, res, next) => {
  const { user_id, user_type, photo: currentPhoto } = req.user;
  const data = req.body;

  if (!data || Object.keys(data).length === 0) {
    return next(new AppError("No data provided to update", 400));
  }

  logger.info(`Update profile for user ${user_id} (${user_type})`);

  if (data.photo) {
    await sql.query`
      UPDATE dbo.Users
      SET photo = ${data.photo}
      WHERE user_id = ${user_id};
    `;
  }

  let updateQuery;
  let selectQuery;

  if (user_type === "patient") {
    const { full_name, date_of_birth, gender, phone, blood_type } = data;

    updateQuery = sql.query`
      UPDATE dbo.Patients
      SET
        full_name = COALESCE(${full_name}, full_name),
        date_of_birth = COALESCE(${date_of_birth}, date_of_birth),
        gender = COALESCE(${gender}, gender),
        phone = COALESCE(${phone}, phone),
        blood_type = COALESCE(${blood_type}, blood_type)
      WHERE user_id = ${user_id};
    `;

    selectQuery = sql.query`
      SELECT
        full_name,
        date_of_birth,
        gender,
        phone,
        blood_type
      FROM dbo.Patients
      WHERE user_id = ${user_id};
    `;
  } else if (user_type === "doctor") {
    const {
      full_name,
      gender,
      years_of_experience,
      bio,
      consultation_price,
      work_from,
      work_to,
    } = data;

    updateQuery = sql.query`
      UPDATE dbo.Doctors
      SET
        full_name = COALESCE(${full_name}, full_name),
        gender = COALESCE(${gender}, gender),
        years_of_experience = COALESCE(${years_of_experience}, years_of_experience),
        bio = COALESCE(${bio}, bio),
        consultation_price = COALESCE(${consultation_price}, consultation_price),
        work_from = COALESCE(${work_from}, work_from),
        work_to = COALESCE(${work_to}, work_to)
      WHERE user_id = ${user_id};
    `;

    selectQuery = sql.query`
      SELECT
        full_name,
        gender,
        years_of_experience,
        bio,
        consultation_price,
        work_from,
        work_to
      FROM dbo.Doctors
      WHERE user_id = ${user_id};
    `;
  } else if (user_type === "staff") {
    const { full_name, role_title } = data;

    updateQuery = sql.query`
      UPDATE dbo.Staff
      SET
        full_name = COALESCE(${full_name}, full_name),
        role_title = COALESCE(${role_title}, role_title)
      WHERE user_id = ${user_id};
    `;

    selectQuery = sql.query`
      SELECT
        full_name,
        clinic_id,
        role_title
      FROM dbo.Staff
      WHERE user_id = ${user_id};
    `;
  } else if (user_type === "admin") {
    const { position_title } = data;

    updateQuery = sql.query`
      UPDATE dbo.Admins
      SET
        position_title = COALESCE(${position_title}, position_title)
      WHERE user_id = ${user_id};
    `;

    selectQuery = sql.query`
      SELECT position_title
      FROM dbo.Admins
      WHERE user_id = ${user_id};
    `;
  } else {
    return next(new AppError("Profile update not allowed", 403));
  }

  const result = await updateQuery;

  if (result.rowsAffected[0] === 0) {
    return next(new AppError("Profile not found", 404));
  }

  const updatedProfile = (await selectQuery).recordset[0];

  res.status(200).json({
    status: "success",
    message: "Profile updated successfully",
    photo: data.photo || currentPhoto || null,
    profile: updatedProfile,
  });
});
