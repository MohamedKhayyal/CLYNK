const { sql } = require("../config/db.Config");
const catchAsync = require("../utilts/catch.Async");
const AppError = require("../utilts/app.Error");
const { createNotification } = require("../utilts/notification");

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

  /* ===== CHECK IF USER ALREADY HAS CLINIC ===== */
  const exists = await sql.query`
    SELECT clinic_id FROM dbo.Clinics
    WHERE owner_user_id = ${ownerUserId};
  `;

  if (exists.recordset.length) {
    return next(new AppError("You already created a clinic", 409));
  }

  /* ===== CREATE CLINIC ===== */
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

  const clinic = result.recordset[0];

  /* ===== NOTIFY ADMINS ===== */
  const adminsResult = await sql.query`
    SELECT user_id FROM dbo.Admins;
  `;

  for (const admin of adminsResult.recordset) {
    await createNotification({
      user_id: admin.user_id,
      title: `New Clinic Pending Approval: ${name}`,
      message: `A new clinic "${name}" has been created and is waiting for approval.`,
    });
  }

  res.status(201).json({
    status: "success",
    clinic,
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

exports.getActiveClinicStaff = catchAsync(async (req, res, next) => {
  const clinicId = Number(req.params.clinicId);

  if (!clinicId) {
    return next(new AppError("Invalid clinic id", 400));
  }

  const result = await sql.query`
    SELECT
      s.staff_id,
      s.full_name,
      s.role_title,
      s.specialist,
      u.photo
    FROM dbo.Staff s
    JOIN dbo.Users u
      ON s.user_id = u.user_id
    WHERE s.clinic_id = ${clinicId}
      AND s.is_verified = 1
      AND u.is_active = 1
    ORDER BY s.full_name ASC;
  `;

  res.status(200).json({
    status: "success",
    results: result.recordset.length,
    staff: result.recordset,
  });
});
