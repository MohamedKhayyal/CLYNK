const bcrypt = require("bcryptjs");
const { sql } = require("../config/db.Config");
const catchAsync = require("../utilts/catch.Async");
const AppError = require("../utilts/app.Error");
const logger = require("../utilts/logger");
const { createNotification } = require("../utilts/notification");

exports.createAdmin = catchAsync(async (req, res, next) => {
  const { email, password, position_title } = req.body;

  logger.warn(`Admin creation attempt: ${email}`);

  if (!email || !password) {
    return next(new AppError("Email and password are required", 400));
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
    const userResult = await transaction.request().query(`
      INSERT INTO dbo.Users (email, password, user_type)
      OUTPUT INSERTED.user_id
      VALUES ('${email}', '${hashedPassword}', 'admin');
    `);

    const userId = userResult.recordset[0].user_id;

    await transaction.request().query(`
      INSERT INTO dbo.Admins (user_id, position_title)
      VALUES (${userId}, ${position_title ? `'${position_title}'` : "NULL"});
    `);

    await transaction.commit();

    logger.warn(`ADMIN CREATED: ${email}`);

    res.status(201).json({
      status: "success",
      user: {
        user_id: userId,
        email,
        role: "admin",
      },
    });
  } catch (err) {
    await transaction.rollback();
    logger.error(`Create admin failed: ${err.message}`);
    next(err);
  }
});

exports.getClinics = catchAsync(async (req, res, next) => {
  const { status } = req.query;

  logger.info(`Admin get clinics (status=${status || "all"})`);

  const result = status
    ? await sql.query`
        SELECT
          c.clinic_id,
          c.name,
          c.email,
          c.phone,
          c.location,
          c.status,
          c.created_at,
          u.email AS owner_email
        FROM dbo.Clinics c
        JOIN dbo.Users u ON c.owner_user_id = u.user_id
        WHERE c.status = ${status};
      `
    : await sql.query`
        SELECT
          c.clinic_id,
          c.name,
          c.email,
          c.phone,
          c.location,
          c.status,
          c.created_at,
          u.email AS owner_email
        FROM dbo.Clinics c
        JOIN dbo.Users u ON c.owner_user_id = u.user_id;
      `;

  res.status(200).json({
    status: "success",
    results: result.recordset.length,
    clinics: result.recordset,
  });
});

exports.approveClinic = catchAsync(async (req, res, next) => {
  const clinicId = Number(req.params.id);
  const adminUserId = req.user.user_id;

  if (!clinicId) {
    return next(new AppError("Invalid clinic id", 400));
  }

  /* ===== ADMIN CHECK ===== */
  const adminResult = await sql.query`
    SELECT admin_id FROM dbo.Admins WHERE user_id = ${adminUserId};
  `;

  const admin = adminResult.recordset[0];
  if (!admin) {
    return next(new AppError("Admin access required", 403));
  }

  /* ===== CLINIC CHECK ===== */
  const clinicResult = await sql.query`
    SELECT clinic_id, status, owner_user_id
    FROM dbo.Clinics
    WHERE clinic_id = ${clinicId};
  `;

  const clinic = clinicResult.recordset[0];
  if (!clinic) {
    return next(new AppError("Clinic not found", 404));
  }

  if (clinic.status !== "pending") {
    return next(new AppError("Only pending clinics can be approved", 400));
  }

  /* ===== UPDATE ===== */
  await sql.query`
    UPDATE dbo.Clinics
    SET
      status = 'approved',
      verified_by_admin_id = ${admin.admin_id},
      verified_at = SYSDATETIME()
    WHERE clinic_id = ${clinicId};
  `;

  /* ===== NOTIFICATION ===== */
  await createNotification({
    user_id: clinic.owner_user_id,
    title: "Clinic Approved ✅",
    message: "Your clinic has been approved and is now live on the platform.",
  });

  res.status(200).json({
    status: "success",
    message: "Clinic approved successfully",
  });
});

exports.rejectClinic = catchAsync(async (req, res, next) => {
  const clinicId = Number(req.params.id);
  const adminUserId = req.user.user_id;

  if (!clinicId) {
    return next(new AppError("Invalid clinic id", 400));
  }

  const adminResult = await sql.query`
    SELECT admin_id FROM dbo.Admins WHERE user_id = ${adminUserId};
  `;

  const admin = adminResult.recordset[0];
  if (!admin) {
    return next(new AppError("Admin access required", 403));
  }

  const clinicResult = await sql.query`
    SELECT clinic_id, status, owner_user_id
    FROM dbo.Clinics
    WHERE clinic_id = ${clinicId};
  `;

  const clinic = clinicResult.recordset[0];
  if (!clinic) {
    return next(new AppError("Clinic not found", 404));
  }

  if (clinic.status !== "pending") {
    return next(new AppError("Only pending clinics can be rejected", 400));
  }

  await sql.query`
    UPDATE dbo.Clinics
    SET
      status = 'rejected',
      verified_by_admin_id = ${admin.admin_id},
      verified_at = SYSDATETIME()
    WHERE clinic_id = ${clinicId};
  `;

  await createNotification({
    user_id: clinic.owner_user_id,
    title: "Clinic Rejected ❌",
    message:
      "Your clinic has been rejected. Please review the requirements and try again.",
  });

  res.status(200).json({
    status: "success",
    message: "Clinic rejected successfully",
  });
});

exports.verifyDoctor = catchAsync(async (req, res, next) => {
  const doctorId = Number(req.params.id);
  const adminUserId = req.user.user_id;

  if (!doctorId) {
    return next(new AppError("Invalid doctor id", 400));
  }

  /* ===== CHECK ADMIN ===== */
  const adminCheck = await sql.query`
    SELECT admin_id FROM dbo.Admins WHERE user_id = ${adminUserId};
  `;
  if (!adminCheck.recordset.length) {
    return next(new AppError("Admin access required", 403));
  }

  /* ===== CHECK DOCTOR ===== */
  const doctorResult = await sql.query`
    SELECT doctor_id, user_id, is_verified
    FROM dbo.Doctors
    WHERE doctor_id = ${doctorId};
  `;

  const doctor = doctorResult.recordset[0];
  if (!doctor) {
    return next(new AppError("Doctor not found", 404));
  }

  if (doctor.is_verified) {
    return next(new AppError("Doctor already verified", 400));
  }

  /* ===== UPDATE ===== */
  await sql.query`
    UPDATE dbo.Doctors
    SET is_verified = 1
    WHERE doctor_id = ${doctorId};
  `;

  /* ===== NOTIFICATION ===== */
  await createNotification({
    user_id: doctor.user_id,
    title: "Doctor Account Verified ✅",
    message:
      "Your doctor account has been verified by the admin. You can now receive appointments.",
  });

  logger.info(`Doctor ${doctorId} verified by admin ${adminUserId}`);

  res.status(200).json({
    status: "success",
    message: "Doctor verified successfully",
  });
});

exports.unverifyDoctor = catchAsync(async (req, res, next) => {
  const doctorId = Number(req.params.id);
  const adminUserId = req.user.user_id;

  if (!doctorId) {
    return next(new AppError("Invalid doctor id", 400));
  }

  const adminCheck = await sql.query`
    SELECT admin_id FROM dbo.Admins WHERE user_id = ${adminUserId};
  `;
  if (!adminCheck.recordset.length) {
    return next(new AppError("Admin access required", 403));
  }

  /* ===== CHECK DOCTOR ===== */
  const doctorResult = await sql.query`
    SELECT doctor_id, user_id, is_verified
    FROM dbo.Doctors
    WHERE doctor_id = ${doctorId};
  `;

  const doctor = doctorResult.recordset[0];
  if (!doctor) {
    return next(new AppError("Doctor not found", 404));
  }

  if (!doctor.is_verified) {
    return next(new AppError("Doctor already unverified", 400));
  }

  /* ===== UPDATE ===== */
  await sql.query`
    UPDATE dbo.Doctors
    SET is_verified = 0
    WHERE doctor_id = ${doctorId};
  `;

  /* ===== NOTIFICATION ===== */
  await createNotification({
    user_id: doctor.user_id,
    title: "Doctor Account Unverified ⚠️",
    message:
      "Your doctor account has been unverified by the admin. Please review your information or contact support.",
  });

  logger.warn(`Doctor ${doctorId} unverified by admin ${adminUserId}`);

  res.status(200).json({
    status: "success",
    message: "Doctor unverified successfully",
  });
});

exports.getAllDoctors = catchAsync(async (req, res, next) => {
  const result = await sql.query`
    SELECT
      d.doctor_id,
      d.user_id,
      d.full_name,
      d.gender,
      d.years_of_experience,
      d.bio,
      d.consultation_price,
      d.work_from,
      d.work_to,
      d.is_verified,

      u.email,
      u.photo,
      u.is_active,
      u.created_at

    FROM dbo.Doctors d
    INNER JOIN dbo.Users u
      ON d.user_id = u.user_id
    ORDER BY d.is_verified ASC, u.created_at DESC;
  `;

  res.status(200).json({
    status: "success",
    results: result.recordset.length,
    doctors: result.recordset,
  });
});
