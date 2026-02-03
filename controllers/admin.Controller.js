const bcrypt = require("bcryptjs");
const { sql } = require("../config/db.Config");
const catchAsync = require("../utilts/catch.Async");
const AppError = require("../utilts/app.Error");
const logger = require("../utilts/logger");

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
  const { action } = req.body;
  const adminUserId = req.user.user_id;

  if (!clinicId) {
    return next(new AppError("Invalid clinic id", 400));
  }

  if (!["approve", "reject"].includes(action)) {
    return next(new AppError("Action must be approve or reject", 400));
  }

  /* Admin profile */
  const adminResult = await sql.query`
    SELECT admin_id FROM dbo.Admins WHERE user_id = ${adminUserId};
  `;

  const admin = adminResult.recordset[0];
  if (!admin) {
    return next(new AppError("Admin profile not found", 403));
  }

  /* Clinic check */
  const clinicCheck = await sql.query`
    SELECT clinic_id, status
    FROM dbo.Clinics
    WHERE clinic_id = ${clinicId};
  `;

  const clinic = clinicCheck.recordset[0];
  if (!clinic) {
    return next(new AppError("Clinic not found", 404));
  }

  if (clinic.status !== "pending") {
    return next(
      new AppError("Only pending clinics can be approved or rejected", 400),
    );
  }

  const newStatus = action === "approve" ? "approved" : "rejected";

  await sql.query`
    UPDATE dbo.Clinics
    SET
      status = ${newStatus},
      verified_by_admin_id = ${admin.admin_id},
      verified_at = SYSDATETIME()
    WHERE clinic_id = ${clinicId};
  `;

  logger.warn(
    `Clinic ${clinicId} ${newStatus.toUpperCase()} by admin ${admin.admin_id}`,
  );

  res.status(200).json({
    status: "success",
    message: `Clinic ${newStatus}`,
  });
});

exports.verifyDoctor = catchAsync(async (req, res, next) => {
  const doctorId = Number(req.params.id);
  const { is_verified } = req.body;
  const adminUserId = req.user.user_id;

  if (!doctorId) {
    return next(new AppError("Invalid doctor id", 400));
  }

  if (typeof is_verified !== "boolean") {
    return next(new AppError("is_verified must be boolean", 400));
  }

  const adminResult = await sql.query`
    SELECT admin_id FROM dbo.Admins WHERE user_id = ${adminUserId};
  `;

  if (!adminResult.recordset.length) {
    return next(new AppError("Admin profile not found", 403));
  }

  const result = await sql.query`
    UPDATE dbo.Doctors
    SET is_verified = ${is_verified ? 1 : 0}
    WHERE doctor_id = ${doctorId};
  `;

  if (result.rowsAffected[0] === 0) {
    return next(new AppError("Doctor not found", 404));
  }

  logger.warn(
    `Doctor ${doctorId} verification set to ${is_verified} by admin user ${adminUserId}`,
  );

  res.status(200).json({
    status: "success",
    message: `Doctor ${is_verified ? "verified" : "unverified"} successfully`,
    doctor: {
      doctor_id: doctorId,
      is_verified,
    },
  });
});
