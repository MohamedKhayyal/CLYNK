const bcrypt = require("bcryptjs");
const { sql } = require("../config/db.Config");
const catchAsync = require("../utilts/catch.Async");
const AppError = require("../utilts/app.Error");
const logger = require("../utilts/logger");

const EMAIL_REGEX = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;

exports.createStaffForClinic = catchAsync(async (req, res, next) => {
  const { email, password, full_name, role_title } = req.body;
  const { clinic_id } = req.clinic;

  logger.info(`Create staff for clinic ${clinic_id}`);

  if (!email || !password || !full_name) {
    return next(
      new AppError("Email, password and full_name are required", 400)
    );
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
    /* Users */
    const userResult = await transaction.request().query`
      INSERT INTO dbo.Users (email, password, user_type)
      OUTPUT INSERTED.user_id
      VALUES (${email}, ${hashedPassword}, 'staff');
    `;

    const userId = userResult.recordset[0].user_id;

    /* Staff */
    await transaction.request().query`
      INSERT INTO dbo.Staff
        (user_id, clinic_id, full_name, role_title, is_verified)
      VALUES
        (${userId}, ${clinic_id}, ${full_name}, ${role_title}, 0);
    `;

    await transaction.commit();

    logger.info(`Staff created (user ${userId}) for clinic ${clinic_id}`);

    res.status(201).json({
      status: "success",
      staff: {
        user_id: userId,
        email,
        full_name,
        role_title,
        clinic_id,
        is_verified: false,
      },
    });
  } catch (err) {
    await transaction.rollback();
    logger.error(`Create staff failed: ${err.message}`);
    next(err);
  }
});

exports.getMyClinicStaff = catchAsync(async (req, res, next) => {
  const { clinic_id } = req.clinic;

  logger.info(`Get staff for clinic ${clinic_id}`);

  const staffResult = await sql.query`
    SELECT
      s.staff_id,
      s.full_name,
      s.role_title,
      s.is_verified,
      u.email,
      u.is_active,
      u.photo
    FROM dbo.Staff s
    JOIN dbo.Users u ON s.user_id = u.user_id
    WHERE s.clinic_id = ${clinic_id};
  `;

  res.status(200).json({
    status: "success",
    results: staffResult.recordset.length,
    staff: staffResult.recordset,
  });
});

exports.verifyStaff = catchAsync(async (req, res, next) => {
  const staffId = Number(req.params.staffId);
  const { clinic_id } = req.clinic;

  if (!staffId) {
    return next(new AppError("Invalid staff id", 400));
  }

  const staffResult = await sql.query`
    SELECT staff_id, is_verified
    FROM dbo.Staff
    WHERE staff_id = ${staffId}
      AND clinic_id = ${clinic_id};
  `;

  const staff = staffResult.recordset[0];

  if (!staff) {
    return next(new AppError("Staff not found in your clinic", 404));
  }

  if (staff.is_verified) {
    return next(new AppError("Staff already verified", 400));
  }

  await sql.query`
    UPDATE dbo.Staff
    SET is_verified = 1
    WHERE staff_id = ${staffId};
  `;

  res.status(200).json({
    status: "success",
    message: "Staff verified successfully",
    staff_id: staffId,
  });
});
