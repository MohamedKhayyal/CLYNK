const { sql } = require("../config/db.Config");
const AppError = require("../utilts/app.Error");
const catchAsync = require("../utilts/catch.Async");

exports.getDoctors = catchAsync(async (req, res) => {
  const { specialist } = req.query;

  const request = new sql.Request();

  let specialistFilter = "";
  if (specialist) {
    specialistFilter = "AND d.specialist = @specialist";
    request.input("specialist", sql.NVarChar, specialist);
  }

  const result = await request.query(`
    SELECT
      d.doctor_id,
      d.full_name,
      d.gender,
      d.years_of_experience,
      d.bio,
      d.consultation_price,
      CONVERT(VARCHAR(5), d.work_from, 108) AS work_from,
      CONVERT(VARCHAR(5), d.work_to, 108)   AS work_to,
      d.work_days,
      d.location,
      d.specialist,
      u.photo,

      COUNT(b.booking_id)               AS total_bookings,
      COUNT(DISTINCT b.patient_user_id) AS total_patients,

      CAST(1 AS BIT) AS can_be_booked

    FROM dbo.Doctors d

    JOIN dbo.Users u
      ON u.user_id = d.user_id

    LEFT JOIN dbo.Clinics c
      ON c.owner_user_id = d.user_id
     AND c.status = 'approved'

    LEFT JOIN dbo.Bookings b
      ON b.doctor_id = d.doctor_id
     AND b.status = 'confirmed'

    WHERE
      d.is_verified = 1
      AND c.clinic_id IS NULL
      ${specialistFilter}

    GROUP BY
      d.doctor_id,
      d.full_name,
      d.gender,
      d.years_of_experience,
      d.bio,
      d.consultation_price,
      d.work_from,
      d.work_to,
      d.work_days,
      d.location,
      d.specialist,
      u.photo

    ORDER BY
      d.years_of_experience DESC,
      d.full_name;
  `);

  res.status(200).json({
    status: "success",
    results: result.recordset.length,
    doctors: result.recordset,
  });
});

exports.getDoctorProfile = catchAsync(async (req, res, next) => {
  const doctor_id = Number(req.params.id);

  if (!doctor_id) {
    return next(new AppError("Invalid doctor id", 400));
  }

  const doctor = await sql.query`
    SELECT
      d.doctor_id,
      d.user_id,
      u.email,
      d.full_name,
      d.phone,
      d.gender,
      d.specialist,
      d.work_days,
      CONVERT(VARCHAR(5), d.work_from,108) AS work_from,
      CONVERT(VARCHAR(5), d.work_to,108)   AS work_to,
      d.location,
      d.consultation_price,
      d.years_of_experience,
      d.bio,
      d.is_verified,
      u.photo,

      COUNT(b.booking_id)                     AS total_bookings,
      COUNT(DISTINCT b.patient_user_id)       AS total_patients

    FROM dbo.Doctors d

    JOIN dbo.Users u
      ON u.user_id = d.user_id

    LEFT JOIN dbo.Clinics c
      ON c.owner_user_id = d.user_id
     AND c.status = 'approved'

    LEFT JOIN dbo.Bookings b
      ON b.doctor_id = d.doctor_id
     AND b.status = 'confirmed'

    WHERE
      d.doctor_id = ${doctor_id}
      AND d.is_verified = 1
      AND c.clinic_id IS NULL

    GROUP BY
      d.doctor_id,
      d.user_id,
      u.email,
      d.full_name,
      d.phone,
      d.gender,
      d.specialist,
      d.work_days,
      d.work_from,
      d.work_to,
      d.location,
      d.consultation_price,
      d.years_of_experience,
      d.bio,
      d.is_verified,
      u.photo,
      u.created_at;
  `;

  if (!doctor.recordset.length) {
    return next(new AppError("Doctor not found or not available for booking", 404));
  }

  res.status(200).json({
    status: "success",
    doctor: {
      ...doctor.recordset[0],
    },
  });
});

exports.getDoctorDashboard = catchAsync(async (req, res, next) => {
  const user_id = req.user.user_id;

  const doctor = (
    await sql.query`
      SELECT doctor_id
      FROM dbo.Doctors
      WHERE user_id = ${user_id}
        AND is_verified = 1;
    `
  ).recordset[0];

  if (!doctor) {
    return next(new AppError("Doctor profile not found", 404));
  }

  const doctor_id = doctor.doctor_id;

  const stats = (
    await sql.query`
      SELECT
        COUNT(*) AS total_bookings,
        COUNT(DISTINCT patient_user_id) AS total_patients,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed_bookings,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_bookings,
        SUM(
          CASE
            WHEN booking_date = CAST(GETDATE() AS DATE)
             AND status = 'confirmed'
            THEN 1 ELSE 0
          END
        ) AS today_bookings
      FROM dbo.Bookings
      WHERE doctor_id = ${doctor_id};
    `
  ).recordset[0];

  const upcomingBookings = await sql.query`
    SELECT TOP 5
      b.booking_id,
      b.booking_date,
      CONVERT(VARCHAR(5), b.booking_from,108) AS booking_from,
      CONVERT(VARCHAR(5), b.booking_to,108)   AS booking_to,
      p.full_name AS patient_name,
      p.phone     AS patient_phone
    FROM dbo.Bookings b
    JOIN dbo.Patients p
      ON p.user_id = b.patient_user_id
    WHERE b.doctor_id = ${doctor_id}
      AND b.status = 'confirmed'
      AND b.booking_date >= CAST(GETDATE() AS DATE)
    ORDER BY b.booking_date, b.booking_from;
  `;

  res.status(200).json({
    status: "success",
    dashboard: {
      stats,
      upcoming_bookings: upcomingBookings.recordset,
    },
  });
});
