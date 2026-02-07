const { sql } = require("../config/db.Config");
const catchAsync = require("../utilts/catch.Async");
const AppError = require("../utilts/app.Error");

exports.getMe = catchAsync(async (req, res, next) => {
  const { user_id } = req.user;

  const userResult = await sql.query`
    SELECT email, user_type, is_active, photo
    FROM dbo.Users
    WHERE user_id = ${user_id};
  `;

  if (!userResult.recordset.length) {
    return next(new AppError("User not found", 404));
  }

  const { email, user_type, is_active, photo } = userResult.recordset[0];
  let profile = null;

  if (user_type === "patient") {
    profile = (
      await sql.query`
        SELECT full_name, date_of_birth, gender, phone, blood_type
        FROM dbo.Patients
        WHERE user_id = ${user_id};
      `
    ).recordset[0];
  } else if (user_type === "doctor") {
    profile = (
      await sql.query`
        SELECT
          full_name,
          gender,
          years_of_experience,
          bio,
          consultation_price,
          work_from,
          work_to,
          specialist,
          work_days,
          location,
          is_verified
        FROM dbo.Doctors
        WHERE user_id = ${user_id};
      `
    ).recordset[0];
  } else if (user_type === "staff") {
    profile = (
      await sql.query`
        SELECT
          full_name,
          clinic_id,
          role_title,
          specialist,
          is_verified
        FROM dbo.Staff
        WHERE user_id = ${user_id};
      `
    ).recordset[0];
  } else if (user_type === "admin") {
    profile = (
      await sql.query`
        SELECT full_name
        FROM dbo.Admins
        WHERE user_id = ${user_id};
      `
    ).recordset[0];
  }

  res.status(200).json({
    status: "success",
    user: {
      user_id,
      email,
      role: user_type,
      is_active,
      photo,
      profile,
    },
  });
});

exports.updateMe = catchAsync(async (req, res, next) => {
  const { user_id, user_type } = req.user;
  const data = { ...req.body };

  if (!data || Object.keys(data).length === 0) {
    return next(new AppError("No data provided to update", 400));
  }

  let photo;

  if (data.photo) {
    await sql.query`
      UPDATE dbo.Users
      SET photo = ${data.photo}
      WHERE user_id = ${user_id};
    `;
    photo = data.photo;
  } else {
    const current = await sql.query`
      SELECT photo FROM dbo.Users WHERE user_id = ${user_id};
    `;
    photo = current.recordset[0]?.photo || null;
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
      SELECT full_name, date_of_birth, gender, phone, blood_type
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
      specialist,
      work_days,
      location,
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
        work_to = COALESCE(${work_to}, work_to),
        specialist = COALESCE(${specialist}, specialist),
        work_days = COALESCE(${work_days}, work_days),
        location = COALESCE(${location}, location)
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
        work_to,
        specialist,
        work_days,
        location,
        is_verified
      FROM dbo.Doctors
      WHERE user_id = ${user_id};
    `;
  } else if (user_type === "staff") {
    const { full_name } = data;

    updateQuery = sql.query`
      UPDATE dbo.Staff
      SET full_name = COALESCE(${full_name}, full_name)
      WHERE user_id = ${user_id};
    `;

    selectQuery = sql.query`
      SELECT full_name, clinic_id, role_title, specialist, is_verified
      FROM dbo.Staff
      WHERE user_id = ${user_id};
    `;
  } else if (user_type === "admin") {
    const { full_name } = data;

    if (!full_name && !data.photo) {
      return next(
        new AppError("Admin can only update full_name or photo", 400),
      );
    }

    if (full_name) {
      updateQuery = sql.query`
        UPDATE dbo.Admins
        SET full_name = ${full_name}
        WHERE user_id = ${user_id};
      `;
    } else {
      updateQuery = { rowsAffected: [1] };
    }

    selectQuery = sql.query`
      SELECT full_name
      FROM dbo.Admins
      WHERE user_id = ${user_id};
    `;
  } else {
    return next(new AppError("Profile update not allowed", 403));
  }

  const result = updateQuery.rowsAffected ? updateQuery : await updateQuery;

  if (result.rowsAffected[0] === 0) {
    return next(new AppError("Profile not found", 404));
  }

  const profile = selectQuery ? (await selectQuery).recordset[0] : null;

  res.status(200).json({
    status: "success",
    message: "Profile updated successfully",
    photo,
    profile,
  });
});
