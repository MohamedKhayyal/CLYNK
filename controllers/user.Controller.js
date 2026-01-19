const { sql } = require("../config/db.Config");
const catchAsync = require("../utilts/catch.Async");
const AppError = require("../utilts/app.Error");
const logger = require("../utilts/logger");

exports.getMe = catchAsync(async (req, res, next) => {
  if (!req.user) {
    logger.warn("getMe failed: req.user is undefined");
    return next(new AppError("Unauthorized", 401));
  }

  const { user_id, user_type } = req.user;

  logger.info(`GetMe request for user ${user_id} (${user_type})`);

  let profileQuery;

  if (user_type === "patient") {
    logger.info(`Fetching patient profile for user ${user_id}`);
    profileQuery = sql.query`
      SELECT full_name, date_of_birth, gender, phone, blood_type
      FROM dbo.Patients
      WHERE user_id = ${user_id};
    `;
  } else if (user_type === "doctor") {
    logger.info(`Fetching doctor profile for user ${user_id}`);
    profileQuery = sql.query`
      SELECT full_name, license_number, gender, years_of_experience, bio, is_verified
      FROM dbo.Doctors
      WHERE user_id = ${user_id};
    `;
  } else if (user_type === "staff") {
    logger.info(`Fetching staff profile for user ${user_id}`);
    profileQuery = sql.query`
      SELECT full_name, clinic_id, role_title
      FROM dbo.Staff
      WHERE user_id = ${user_id};
    `;
  } else if (user_type === "admin") {
    logger.info(`Fetching admin profile for user ${user_id}`);
    profileQuery = sql.query`
      SELECT position_title
      FROM dbo.Admins
      WHERE user_id = ${user_id};
    `;
  } else {
    logger.error(`Invalid user_type detected: ${user_type}`);
    return next(new AppError("Invalid user role", 400));
  }

  const profileResult = await profileQuery;

  if (!profileResult.recordset.length) {
    logger.warn(`Profile not found for user ${user_id} (${user_type})`);
  }

  const profile = profileResult.recordset[0] || null;

  logger.info(`GetMe success for user ${user_id}`);

  res.status(200).json({
    status: "success",
    user: {
      user_id: req.user.user_id,
      email: req.user.email,
      role: req.user.user_type,
      is_active: req.user.is_active,
      created_at: req.user.created_at,
      profile,
    },
  });
});

exports.updateMe = catchAsync(async (req, res, next) => {
  const { user_id, user_type } = req.user;
  const data = req.body;

  if (!data || Object.keys(data).length === 0) {
    return next(new AppError("No data provided to update", 400));
  }

  logger.info(`UpdateMe attempt for user ${user_id} (${user_type})`);

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
    const { full_name, gender, years_of_experience, bio } = data;

    updateQuery = sql.query`
      UPDATE dbo.Doctors
      SET
        full_name = COALESCE(${full_name}, full_name),
        gender = COALESCE(${gender}, gender),
        years_of_experience = COALESCE(${years_of_experience}, years_of_experience),
        bio = COALESCE(${bio}, bio)
      WHERE user_id = ${user_id};
    `;

    selectQuery = sql.query`
      SELECT full_name, gender, years_of_experience, bio, is_verified
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
      SELECT full_name, clinic_id, role_title
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

  const updateResult = await updateQuery;

  if (updateResult.rowsAffected[0] === 0) {
    return next(new AppError("Profile not found", 404));
  }

  const updatedProfileResult = await selectQuery;
  const profile = updatedProfileResult.recordset[0];

  logger.info(`UpdateMe success for user ${user_id}`);

  res.status(200).json({
    status: "success",
    message: "Profile updated successfully",
    profile,
  });
});
