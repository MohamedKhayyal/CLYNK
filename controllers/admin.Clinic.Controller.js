const { sql } = require("../config/db.Config");
const catchAsync = require("../utilts/catch.Async");
const AppError = require("../utilts/app.Error");
const logger = require("../utilts/logger");

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
