const bcrypt = require("bcryptjs");
const { sql } = require("../config/db.Config");
const catchAsync = require("../utilts/catch.Async");
const AppError = require("../utilts/app.Error");
const logger = require("../utilts/logger");

const EMAIL_REGEX = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;

/* ================= CREATE STAFF (NO CLINIC ID) ================= */
exports.createStaffForClinic = catchAsync(async (req, res, next) => {
  const { email, password, full_name, role_title } = req.body;
  const ownerUserId = req.user.user_id;

  logger.info(`Create staff by clinic owner user ${ownerUserId}`);

  if (!email || !password || !full_name) {
    return next(
      new AppError("Email, password and full_name are required", 400)
    );
  }

  if (!EMAIL_REGEX.test(email)) {
    return next(new AppError("Invalid email format", 400));
  }

  /* 1️⃣ Get owner clinic */
  const clinicResult = await sql.query`
    SELECT clinic_id
    FROM dbo.Clinics
    WHERE owner_user_id = ${ownerUserId}
      AND status = 'approved';
  `;

  const clinic = clinicResult.recordset[0];

  if (!clinic) {
    return next(
      new AppError("You do not own an approved clinic", 403)
    );
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
    const userResult = await transaction.request().query`
      INSERT INTO dbo.Users (email, password, user_type)
      OUTPUT INSERTED.user_id
      VALUES (${email}, ${hashedPassword}, 'staff');
    `;

    const userId = userResult.recordset[0].user_id;

    await transaction.request().query`
      INSERT INTO dbo.Staff
        (user_id, clinic_id, full_name, role_title)
      VALUES
        (${userId}, ${clinic.clinic_id}, ${full_name}, ${role_title});
    `;

    await transaction.commit();

    logger.info(`Staff created (user ${userId}) for clinic ${clinic.clinic_id}`);

    res.status(201).json({
      status: "success",
      staff: {
        user_id: userId,
        email,
        full_name,
        role_title,
        clinic_id: clinic.clinic_id,
      },
    });
  } catch (err) {
    await transaction.rollback();
    logger.error(`Create staff failed: ${err.message}`);
    next(err);
  }
});

exports.getMyClinicStaff = catchAsync(async (req, res, next) => {
  const ownerUserId = req.user.user_id;

  logger.info(`Get staff for clinic owner user ${ownerUserId}`);

  const clinicResult = await sql.query`
    SELECT clinic_id
    FROM dbo.Clinics
    WHERE owner_user_id = ${ownerUserId}
      AND status = 'approved';
  `;

  const clinic = clinicResult.recordset[0];

  if (!clinic) {
    return next(new AppError("You do not own an approved clinic", 403));
  }

  const staffResult = await sql.query`
    SELECT
      s.staff_id,
      s.full_name,
      s.role_title,
      u.email,
      u.is_active,
      u.created_at
    FROM dbo.Staff s
    JOIN dbo.Users u ON s.user_id = u.user_id
    WHERE s.clinic_id = ${clinic.clinic_id};
  `;

  res.status(200).json({
    status: "success",
    results: staffResult.recordset.length,
    staff: staffResult.recordset,
  });
});
