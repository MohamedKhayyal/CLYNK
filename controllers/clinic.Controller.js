const { sql } = require("../config/db.Config");
const catchAsync = require("../utilts/catch.Async");
const AppError = require("../utilts/app.Error");
const logger = require("../utilts/logger");

exports.createClinic = catchAsync(async (req, res, next) => {
  const { name, address, location, phone, email, opening_hours } = req.body;
  const { user_id } = req.user; // من protect middleware

  logger.info(`Create clinic attempt by admin user ${user_id}`);

  if (!name) {
    return next(new AppError("Clinic name is required", 400));
  }

  /**
   * 1️⃣ نجيب admin_id المرتبط بالـ user
   */
  const adminResult = await sql.query`
    SELECT admin_id
    FROM dbo.Admins
    WHERE user_id = ${user_id};
  `;

  const admin = adminResult.recordset[0];

  if (!admin) {
    return next(new AppError("Admin profile not found", 403));
  }

  /**
   * 2️⃣ Create clinic
   */
  const clinicResult = await sql.query`
    INSERT INTO dbo.Clinics
      (admin_id, name, address, location, phone, email, opening_hours)
    OUTPUT INSERTED.clinic_id, INSERTED.name
    VALUES
      (
        ${admin.admin_id},
        ${name},
        ${address || null},
        ${location || null},
        ${phone || null},
        ${email || null},
        ${opening_hours || null}
      );
  `;

  const clinic = clinicResult.recordset[0];

  logger.info(`Clinic created: ${clinic.name} (ID=${clinic.clinic_id})`);

  res.status(201).json({
    status: "success",
    clinic: {
      clinic_id: clinic.clinic_id,
      name: clinic.name,
    },
  });
});
