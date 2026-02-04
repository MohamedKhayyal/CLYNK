const bcrypt = require("bcryptjs");
const { sql } = require("../config/db.Config");
const catchAsync = require("../utilts/catch.Async");
const AppError = require("../utilts/app.Error");
const logger = require("../utilts/logger");
const { createNotification } = require("../utilts/notification");

const EMAIL_REGEX = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;

exports.createStaffForClinic = catchAsync(async (req, res, next) => {
  const { email, password, full_name, role_title } = req.body;
  const { clinic_id } = req.clinic;

  if (!email || !password || !full_name) {
    return next(
      new AppError("Email, password and full_name are required", 400),
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
    const userResult = await transaction.request().query`
      INSERT INTO dbo.Users (email, password, user_type)
      OUTPUT INSERTED.user_id
      VALUES (${email}, ${hashedPassword}, 'staff');
    `;

    const userId = userResult.recordset[0].user_id;

    await transaction.request().query`
      INSERT INTO dbo.Staff
        (user_id, clinic_id, full_name, role_title, is_verified)
      VALUES
        (${userId}, ${clinic_id}, ${full_name}, ${role_title || null}, 0);
    `;

    await transaction.commit();

    await createNotification({
      user_id: userId,
      title: "Staff Account Created",
      message: "Your staff account has been created",
    });

    res.status(201).json({
      status: "success",
      staff: {
        user_id: userId,
        email,
        full_name,
        role_title,
        clinic_id,
        is_verified: true,
      },
    });
  } catch (err) {
    await transaction.rollback();
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
    SELECT staff_id, user_id, is_verified
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

  await createNotification({
    user_id: staff.user_id,
    title: "Staff Account Verified",
    message:
      "Your staff account has been verified. You can now access the clinic system.",
  });

  res.status(200).json({
    status: "success",
    message: "Staff verified successfully",
    staff_id: staffId,
  });
});

exports.getPendingStaff = catchAsync(async (req, res, next) => {
  const { clinic_id } = req.clinic;

  const result = await sql.query`
    SELECT
      s.staff_id,
      s.full_name,
      s.role_title,
      s.is_verified,
      u.email
    FROM dbo.Staff s
    INNER JOIN dbo.Users u
      ON s.user_id = u.user_id
    WHERE s.clinic_id = ${clinic_id}
      AND s.is_verified = 0
    ORDER BY u.created_at DESC;
  `;

  res.status(200).json({
    status: "success",
    results: result.recordset.length,
    staff: result.recordset,
  });
});
