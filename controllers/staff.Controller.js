const bcrypt = require("bcryptjs");
const { sql } = require("../config/db.Config");
const catchAsync = require("../utilts/catch.Async");
const AppError = require("../utilts/app.Error");
const { createNotification } = require("../utilts/notification");

exports.createStaffForClinic = catchAsync(async (req, res, next) => {
  const { email, password, full_name, role_title, specialist } = req.body;
  const { clinic_id, owner_user_id } = req.clinic;

  if (!email || !password || !full_name || !role_title) {
    return next(
      new AppError(
        "Email, password, full_name and role_title are required",
        400,
      ),
    );
  }

  const exists = await sql.query`
    SELECT user_id FROM dbo.Users WHERE email = ${email};
  `;
  if (exists.recordset.length) {
    return next(new AppError("Email already exists", 409));
  }

  if (role_title === "doctor" && !specialist) {
    return next(
      new AppError("Specialist is required when role_title is doctor", 400),
    );
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
        (user_id, clinic_id, full_name, role_title, specialist, is_verified)
      VALUES
        (${userId},
         ${clinic_id},
         ${full_name},
         ${role_title},
         ${role_title === "doctor" ? specialist : null},
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
      title: "New Staff Pending Verification 👤",
      message: `Staff "${full_name}" has been added and is waiting for verification.`,
    });
  }

  res.status(201).json({
    status: "success",
    staff: {
      user_id: userId,
      email,
      full_name,
      role_title,
      specialist: role_title === "doctor" ? specialist : null,
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
    title: "Staff Account Verified ✅",
    message:
      "Your staff account has been verified. You can now access the clinic system.",
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
