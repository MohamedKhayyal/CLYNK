const bcrypt = require("bcryptjs");
const { sql } = require("../config/db.Config");
const catchAsync = require("../utilts/catch.Async");
const AppError = require("../utilts/app.Error");
const { createNotification } = require("../utilts/notification");

const ALLOWED_STAFF_ROLES = new Set(["doctor", "nurse", "receptionist"]);
const TIME_REGEX = /^\d{2}:\d{2}(:\d{2})?$/;

exports.createStaffForClinic = catchAsync(async (req, res, next) => {
  const {
    email,
    password,
    full_name,
    role_title,
    specialist,
    work_days,
    work_from,
    work_to,
    consultation_price,
  } = req.body;
  const { clinic_id, owner_user_id } = req.clinic;

  if (!email || !password || !full_name || !role_title) {
    return next(
      new AppError(
        "Email, password, full_name and role_title are required",
        400,
      ),
    );
  }

  if (!ALLOWED_STAFF_ROLES.has(role_title)) {
    return next(new AppError("Invalid role_title", 400));
  }

  const exists = await sql.query`
    SELECT user_id FROM dbo.Users WHERE email = ${email};
  `;
  if (exists.recordset.length) {
    return next(new AppError("Email already exists", 409));
  }

  const isDoctor = role_title === "doctor";
  const normalizedWorkDays = Array.isArray(work_days)
    ? work_days.join(",")
    : work_days;
  const normalizedPrice = Number(consultation_price);

  if (isDoctor) {
    if (!specialist) {
      return next(
        new AppError("Specialist is required when role_title is doctor", 400),
      );
    }

    if (!normalizedWorkDays || !work_from || !work_to) {
      return next(
        new AppError(
          "work_days, work_from and work_to are required for staff doctors",
          400,
        ),
      );
    }

    if (!TIME_REGEX.test(work_from) || !TIME_REGEX.test(work_to)) {
      return next(new AppError("Invalid work time format", 400));
    }

    if (Number.isNaN(normalizedPrice) || normalizedPrice < 0) {
      return next(
        new AppError("consultation_price must be a valid non-negative number", 400),
      );
    }
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const transaction = new sql.Transaction(sql.globalConnectionPool);
  let transactionStarted = false;
  let userId;

  try {
    await transaction.begin();
    transactionStarted = true;

    const userResult = await transaction.request().query`
      INSERT INTO dbo.Users (email, password, user_type)
      OUTPUT INSERTED.user_id
      VALUES (${email}, ${hashedPassword}, 'staff');
    `;

    userId = userResult.recordset[0].user_id;

    await transaction.request().query`
      INSERT INTO dbo.Staff
        (user_id,
         clinic_id,
         full_name,
         role_title,
         specialist,
         work_days,
         work_from,
         work_to,
         consultation_price,
         is_verified)
      VALUES
        (${userId},
         ${clinic_id},
         ${full_name},
         ${role_title},
         ${isDoctor ? specialist : null},
         ${isDoctor ? normalizedWorkDays : null},
         ${isDoctor ? work_from : null},
         ${isDoctor ? work_to : null},
         ${isDoctor ? normalizedPrice : null},
         0);
    `;

    await transaction.commit();
  } catch (err) {
    if (transactionStarted) {
      await transaction.rollback();
    }
    return next(err);
  }

  if (owner_user_id) {
    await createNotification({
      user_id: owner_user_id,
      title: "Staff Verification Pending",
      message: `The staff account for "${full_name}" has been created and is awaiting verification.`,
    });
  }

  res.status(201).json({
    status: "success",
    staff: {
      user_id: userId,
      email,
      full_name,
      role_title,
      specialist: isDoctor ? specialist : null,
      work_days: isDoctor ? normalizedWorkDays : null,
      work_from: isDoctor ? work_from : null,
      work_to: isDoctor ? work_to : null,
      consultation_price: isDoctor ? normalizedPrice : null,
      clinic_id,
      is_verified: false,
    },
  });
});

exports.getMyClinicStaff = catchAsync(async (req, res) => {
  const { clinic_id } = req.clinic;

  const staffResult = await sql.query`
    SELECT
      s.staff_id,
      u.email,
      s.full_name,
      s.role_title,
      s.specialist,
      s.is_verified,
      u.is_active,
      u.photo
    FROM dbo.Staff s
    JOIN dbo.Users u
      ON s.user_id = u.user_id
    WHERE s.clinic_id = ${clinic_id}
    ORDER BY s.staff_id DESC;
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
      "Your staff account has been verified. You can now access clinic features.",
  });

  res.status(200).json({
    status: "success",
    message: "Staff verified successfully",
    staff_id: staffId,
  });
});

exports.getPendingStaff = catchAsync(async (req, res) => {
  const { clinic_id } = req.clinic;

  const result = await sql.query`
    SELECT
      s.staff_id,
      s.full_name,
      s.role_title,
      s.specialist,
      u.email,
      u.photo,
      u.created_at
    FROM dbo.Staff s
    JOIN dbo.Users u
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
