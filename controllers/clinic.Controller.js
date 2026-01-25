const { sql } = require("../config/db.Config");
const catchAsync = require("../utilts/catch.Async");
const AppError = require("../utilts/app.Error");
const logger = require("../utilts/logger");

exports.createClinic = catchAsync(async (req, res, next) => {
  const { name, address, location, phone, email, opening_hours } = req.body;
  const ownerUserId = req.user.user_id; 
  logger.info(`Create clinic attempt by user ${ownerUserId}`);

  if (!name || !location || !email) {
    return next(
      new AppError("Clinic name, location and email are required", 400),
    );
  }

  const existingClinic = await sql.query`
    SELECT clinic_id FROM dbo.Clinics
    WHERE owner_user_id = ${ownerUserId};
  `;

  if (existingClinic.recordset.length > 0) {
    return next(new AppError("You already created a clinic", 409));
  }

  const result = await sql.query`
    INSERT INTO dbo.Clinics
      (owner_user_id, name, address, location, phone, email, opening_hours, status)
    OUTPUT
      INSERTED.clinic_id,
      INSERTED.status,
      INSERTED.created_at
    VALUES
      (${ownerUserId},
       ${name},
       ${address || null},
       ${location},
       ${phone || null},
       ${email},
       ${opening_hours || null},
       'pending');
  `;

  const clinic = result.recordset[0];

  logger.info(`Clinic created (PENDING) id=${clinic.clinic_id}`);

  res.status(201).json({
    status: "success",
    clinic: {
      clinic_id: clinic.clinic_id,
      name,
      status: clinic.status,
    },
    message: "Clinic created successfully and pending admin approval",
  });
});

exports.getPublicClinics = catchAsync(async (req, res) => {
  const result = await sql.query`
    SELECT
      clinic_id,
      name,
      address,
      location,
      phone,
      opening_hours
    FROM dbo.Clinics
    WHERE status = 'approved';
  `;

  res.status(200).json({
    status: "success",
    results: result.recordset.length,
    clinics: result.recordset,
  });
});
