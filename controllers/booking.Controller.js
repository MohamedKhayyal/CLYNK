const { sql } = require("../config/db.Config");
const AppError = require("../utilts/app.Error");
const catchAsync = require("../utilts/catch.Async");
const generateSlots = require("../utilts/generate.Slots");
const { createNotification } = require("../utilts/notification");

exports.createBooking = catchAsync(async (req, res, next) => {
  const { doctor_id, staff_id, booking_date, booking_from } = req.body;
  const patient_user_id = req.user.user_id;

  if ((!doctor_id && !staff_id) || (doctor_id && staff_id)) {
    return next(new AppError("Booking must be for doctor OR staff only", 400));
  }

  if (!booking_date || !booking_from) {
    return next(
      new AppError("booking_date and booking_from are required", 400),
    );
  }

  if (!/^\d{2}:\d{2}$/.test(booking_from)) {
    return next(new AppError("booking_from must be HH:mm", 400));
  }

  const start = new Date(`${booking_date}T${booking_from}:00`);
  if (isNaN(start.getTime()) || start < new Date()) {
    return next(new AppError("Invalid booking time", 400));
  }

  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const booking_to = end.toTimeString().slice(0, 5);

  let target;

  if (doctor_id) {
    target = (
      await sql.query`
        SELECT doctor_id, user_id, work_days,
               CONVERT(VARCHAR(5), work_from,108) AS work_from,
               CONVERT(VARCHAR(5), work_to,108)   AS work_to
        FROM dbo.Doctors
        WHERE doctor_id = ${doctor_id}
          AND is_verified = 1;
      `
    ).recordset[0];
  } else {
    target = (
      await sql.query`
        SELECT staff_id, user_id, work_days,
               CONVERT(VARCHAR(5), work_from,108) AS work_from,
               CONVERT(VARCHAR(5), work_to,108)   AS work_to
        FROM dbo.Staff
        WHERE staff_id = ${staff_id}
          AND role_title = 'doctor'
          AND is_verified = 1;
      `
    ).recordset[0];
  }

  if (!target) return next(new AppError("Doctor not available", 404));

  const day = new Date(booking_date)
    .toLocaleDateString("en-US", { weekday: "short" })
    .toLowerCase();

  const allowedDays = target.work_days
    .split(",")
    .map((d) => d.trim().toLowerCase());

  if (!allowedDays.includes(day)) {
    return next(new AppError("Doctor does not work on this day", 400));
  }

  if (booking_from < target.work_from || booking_to > target.work_to) {
    return next(new AppError("Invalid booking time", 400));
  }

  const overlap = doctor_id
    ? await sql.query`
        SELECT booking_id
        FROM dbo.Bookings
        WHERE doctor_id = ${doctor_id}
          AND booking_date = ${booking_date}
          AND status = 'confirmed'
          AND (${booking_from} < booking_to AND ${booking_to} > booking_from);
      `
    : await sql.query`
        SELECT booking_id
        FROM dbo.Bookings
        WHERE staff_id = ${staff_id}
          AND booking_date = ${booking_date}
          AND status = 'confirmed'
          AND (${booking_from} < booking_to AND ${booking_to} > booking_from);
      `;

  if (overlap.recordset.length) {
    return next(new AppError("This time slot is already booked", 409));
  }

  const result = await sql.query`
    INSERT INTO dbo.Bookings
      (patient_user_id, doctor_id, staff_id,
       booking_date, booking_from, booking_to, status)
    OUTPUT INSERTED.booking_id
    VALUES (
      ${patient_user_id},
      ${doctor_id || null},
      ${staff_id || null},
      ${booking_date},
      ${booking_from},
      ${booking_to},
      'confirmed'
    );
  `;

  await createNotification({
    user_id: target.user_id,
    title: "New Booking 📅",
    message: `New booking on ${booking_date} from ${booking_from} to ${booking_to}`,
  });

  res.status(201).json({
    status: "success",
    booking_id: result.recordset[0].booking_id,
  });
});

exports.getMyBookings = catchAsync(async (req, res, next) => {
  const { user_id, user_type } = req.user;
  const { date } = req.query;

  let ownerCondition = "";
  let ownerValue = null;

  if (user_type === "patient") {
    ownerCondition = "b.patient_user_id = @ownerId";
    ownerValue = user_id;
  }

  if (user_type === "doctor") {
    ownerCondition = `
      b.doctor_id = (
        SELECT doctor_id
        FROM dbo.Doctors
        WHERE user_id = @ownerId
      )
    `;
    ownerValue = user_id;
  }

  if (user_type === "staff") {
    ownerCondition = `
      b.staff_id = (
        SELECT staff_id
        FROM dbo.Staff
        WHERE user_id = @ownerId
          AND role_title = 'doctor'
      )
    `;
    ownerValue = user_id;
  }

  if (!ownerCondition) {
    return next(new AppError("Access denied", 403));
  }

  let dateCondition = "";
  if (date) {
    dateCondition = "AND b.booking_date = @bookingDate";
  }

  const request = new sql.Request();
  request.input("ownerId", ownerValue);

  if (date) {
    request.input("bookingDate", date);
  }

  const bookings = await request.query(`
    SELECT
      b.booking_id,
      b.booking_date,
      CONVERT(VARCHAR(5), b.booking_from,108) AS booking_from,
      CONVERT(VARCHAR(5), b.booking_to,108)   AS booking_to,
      b.status,

      /* patient */
      p.full_name AS patient_name,
      p.phone     AS patient_phone,

      /* doctor (free or staff) */
      COALESCE(d.full_name, s.full_name) AS doctor_name

    FROM dbo.Bookings b

    JOIN dbo.Patients p
      ON p.user_id = b.patient_user_id

    LEFT JOIN dbo.Doctors d
      ON d.doctor_id = b.doctor_id

    LEFT JOIN dbo.Staff s
      ON s.staff_id = b.staff_id

    WHERE ${ownerCondition}
      ${dateCondition}

    ORDER BY b.booking_date, b.booking_from;
  `);

  res.status(200).json({
    status: "success",
    results: bookings.recordset.length,
    bookings: bookings.recordset,
  });
});

exports.getAvailableSlots = catchAsync(async (req, res, next) => {
  const { doctor_id, staff_id, booking_date } = req.query;

  if ((!doctor_id && !staff_id) || (doctor_id && staff_id)) {
    return next(new AppError("doctor_id or staff_id is required", 400));
  }

  if (!booking_date) {
    return next(new AppError("booking_date is required", 400));
  }

  let target;

  if (doctor_id) {
    target = (
      await sql.query`
        SELECT work_days,
               CONVERT(VARCHAR(5), work_from,108) AS work_from,
               CONVERT(VARCHAR(5), work_to,108)   AS work_to
        FROM dbo.Doctors
        WHERE doctor_id = ${doctor_id}
          AND is_verified = 1;
      `
    ).recordset[0];
  } else {
    target = (
      await sql.query`
        SELECT work_days,
               CONVERT(VARCHAR(5), work_from,108) AS work_from,
               CONVERT(VARCHAR(5), work_to,108)   AS work_to
        FROM dbo.Staff
        WHERE staff_id = ${staff_id}
          AND role_title='doctor'
          AND is_verified = 1;
      `
    ).recordset[0];
  }

  if (!target) return next(new AppError("Doctor not available", 404));

  const day = new Date(booking_date)
    .toLocaleDateString("en-US", { weekday: "short" })
    .toLowerCase();

  const allowedDays = target.work_days
    .split(",")
    .map((d) => d.trim().toLowerCase());

  if (!allowedDays.includes(day)) {
    return res.json({ status: "success", slots: [] });
  }

  const allSlots = generateSlots(target.work_from, target.work_to, 30);

  const bookings = doctor_id
    ? await sql.query`
        SELECT CONVERT(VARCHAR(5), booking_from,108) AS booking_from,
               CONVERT(VARCHAR(5), booking_to,108)   AS booking_to
        FROM dbo.Bookings
        WHERE doctor_id=${doctor_id}
          AND booking_date=${booking_date}
          AND status='confirmed';
      `
    : await sql.query`
        SELECT CONVERT(VARCHAR(5), booking_from,108) AS booking_from,
               CONVERT(VARCHAR(5), booking_to,108)   AS booking_to
        FROM dbo.Bookings
        WHERE staff_id=${staff_id}
          AND booking_date=${booking_date}
          AND status='confirmed';
      `;

  const availableSlots = allSlots.filter(
    (slot) =>
      !bookings.recordset.some(
        (b) => slot.from < b.booking_to && slot.to > b.booking_from,
      ),
  );

  res.json({ status: "success", slots: availableSlots });
});

exports.cancelBooking = catchAsync(async (req, res, next) => {
  const booking_id = Number(req.params.id);
  const { user_id, user_type } = req.user;

  if (!booking_id) {
    return next(new AppError("Invalid booking id", 400));
  }

  const booking = (
    await sql.query`
      SELECT
        booking_id,
        patient_user_id,
        doctor_id,
        staff_id,
        status
      FROM dbo.Bookings
      WHERE booking_id = ${booking_id};
    `
  ).recordset[0];

  if (!booking) {
    return next(new AppError("Booking not found", 404));
  }

  if (booking.status === "cancelled") {
    return next(new AppError("Booking already cancelled", 400));
  }

  let authorized = false;

  if (user_type === "patient") {
    authorized = booking.patient_user_id === user_id;
  }

  if (user_type === "doctor" && booking.doctor_id) {
    const doctor = (
      await sql.query`
        SELECT doctor_id
        FROM dbo.Doctors
        WHERE user_id = ${user_id};
      `
    ).recordset[0];

    authorized = doctor && doctor.doctor_id === booking.doctor_id;
  }

  if (user_type === "staff" && booking.staff_id) {
    const staff = (
      await sql.query`
        SELECT staff_id
        FROM dbo.Staff
        WHERE user_id = ${user_id}
          AND role_title = 'doctor';
      `
    ).recordset[0];

    authorized = staff && staff.staff_id === booking.staff_id;
  }

  if (!authorized) {
    return next(new AppError("Access denied", 403));
  }

  await sql.query`
    UPDATE dbo.Bookings
    SET status = 'cancelled'
    WHERE booking_id = ${booking_id};
  `;

  await createNotification({
    user_id: booking.patient_user_id,
    title: "Booking Cancelled ❌",
    message: "Your booking has been cancelled.",
  });

  res.status(200).json({
    status: "success",
    message: "Booking cancelled successfully",
  });
});
