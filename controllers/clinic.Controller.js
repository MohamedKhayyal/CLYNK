const { sql } = require("../config/db.Config");
const catchAsync = require("../utilts/catch.Async");
const AppError = require("../utilts/app.Error");

exports.createClinic = catchAsync(async (req, res, next) => {
  const {
    name,
    address,
    location,
    phone,
    email,
    consultation_price,
    work_from,
    work_to,
  } = req.body;

  const ownerUserId = req.user.user_id;

  if (!name || !location || !email) {
    return next(
      new AppError("Clinic name, location and email are required", 400),
    );
  }

  const exists = await sql.query`
    SELECT clinic_id FROM dbo.Clinics
    WHERE owner_user_id = ${ownerUserId};
  `;

  if (exists.recordset.length) {
    return next(new AppError("You already created a clinic", 409));
  }

  const result = await sql.query`
    INSERT INTO dbo.Clinics
      (owner_user_id, name, address, location, phone, email,
       consultation_price, work_from, work_to, status)
    OUTPUT INSERTED.clinic_id, INSERTED.status
    VALUES
      (${ownerUserId},
       ${name},
       ${address || null},
       ${location},
       ${phone || null},
       ${email},
       ${consultation_price || null},
       ${work_from || null},
       ${work_to || null},
       'pending');
  `;

  res.status(201).json({
    status: "success",
    clinic: result.recordset[0],
    message: "Clinic created and pending admin approval",
  });
});

exports.getPublicClinics = catchAsync(async (req, res) => {
  const result = await sql.query`
    SELECT
      clinic_id,
      name,
      location,
      phone,
      consultation_price,
      work_from,
      work_to
    FROM dbo.Clinics
    WHERE status = 'approved';
  `;

  res.status(200).json({
    status: "success",
    results: result.recordset.length,
    clinics: result.recordset,
  });
});
