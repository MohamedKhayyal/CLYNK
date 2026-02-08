const { sql } = require("../config/db.Config");
const AppError = require("../utilts/app.Error");
const catchAsync = require("../utilts/catch.Async");
const { createNotification } = require("../utilts/notification");

const generateSlots = (from, to, duration = 30) => {
  const slots = [];

  let start = new Date(`1970-01-01T${from}`);
  const end = new Date(`1970-01-01T${to}`);

  while (start < end) {
    const slotStart = start.toTimeString().slice(0, 5);
    start.setMinutes(start.getMinutes() + duration);
    const slotEnd = start.toTimeString().slice(0, 5);

    if (start <= end) {
      slots.push({ from: slotStart, to: slotEnd });
    }
  }

  return slots;
};

exports.createBooking = catchAsync(async (req, res, next) => {
  const { doctor_id, staff_id, booking_date, booking_from, booking_to } =
    req.body;

  const patient_user_id = req.user.user_id;

  if ((!doctor_id && !staff_id) || (doctor_id && staff_id)) {
    return next(new AppError("Booking must be for doctor OR staff only", 400));
  }

  if (!booking_date || !booking_from || !booking_to) {
    return next(new AppError("Booking date and time are required", 400));
  }

  const bookingStart = new Date(`${booking_date}T${booking_from}`);
  if (bookingStart < new Date()) {
    return next(new AppError("You cannot book in the past", 400));
  }

  let target;

  if (doctor_id) {
    target = (
      await sql.query`
        SELECT
          doctor_id,
          user_id,
          work_days,
          CONVERT(VARCHAR(5), work_from, 108) AS work_from,
          CONVERT(VARCHAR(5), work_to, 108) AS work_to
        FROM dbo.Doctors
        WHERE doctor_id = ${doctor_id}
          AND is_verified = 1;
      `
    ).recordset[0];
  } else {
    target = (
      await sql.query`
        SELECT
          staff_id,
          user_id,
          work_days,
          CONVERT(VARCHAR(5), work_from, 108) AS work_from,
          CONVERT(VARCHAR(5), work_to, 108) AS work_to
        FROM dbo.Staff
        WHERE staff_id = ${staff_id}
          AND role_title = 'doctor'
          AND is_verified = 1;
      `
    ).recordset[0];
  }

  if (!target) {
    return next(new AppError("Doctor not available", 404));
  }

  const day = new Date(booking_date)
    .toLocaleDateString("en-US", { weekday: "short" })
    .toLowerCase();

  if (!target.work_days.toLowerCase().includes(day)) {
    return next(new AppError("Doctor does not work on this day", 400));
  }

  if (
    booking_from < target.work_from ||
    booking_to > target.work_to ||
    booking_from >= booking_to
  ) {
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
    VALUES
      (
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
    message: `You have a new booking on ${booking_date} from ${booking_from} to ${booking_to}`,
  });

  res.status(201).json({
    status: "success",
    booking_id: result.recordset[0].booking_id,
  });
});

exports.getMyBookings = catchAsync(async (req, res, next) => {
  const user_id = req.user.user_id;
  const role = req.user.user_type;

  let bookings;

  /* ========= DOCTOR ========= */
  if (role === "doctor") {
    const doctor = (
      await sql.query`
        SELECT doctor_id
        FROM dbo.Doctors
        WHERE user_id = ${user_id};
      `
    ).recordset[0];

    if (!doctor) {
      return next(new AppError("Doctor profile not found", 404));
    }

    bookings = await sql.query`
      SELECT
        b.booking_id,
        b.booking_date,
        CONVERT(VARCHAR(5), b.booking_from, 108) AS booking_from,
        CONVERT(VARCHAR(5), b.booking_to, 108)   AS booking_to,
        b.status,
        p.full_name AS patient_full_name,
        p.phone    AS patient_phone,
        u.email     AS patient_email
      FROM dbo.Bookings b
      JOIN dbo.Users u
        ON b.patient_user_id = u.user_id
      JOIN dbo.Patients p
        ON p.user_id = u.user_id
      WHERE b.doctor_id = ${doctor.doctor_id}
      ORDER BY b.booking_date, b.booking_from;
    `;
  } else if (role === "staff") {
    /* ========= STAFF DOCTOR ========= */
    const staff = (
      await sql.query`
        SELECT staff_id
        FROM dbo.Staff
        WHERE user_id = ${user_id}
          AND role_title = 'doctor';
      `
    ).recordset[0];

    if (!staff) {
      return next(new AppError("Staff doctor profile not found", 404));
    }

    bookings = await sql.query`
      SELECT
        b.booking_id,
        b.booking_date,
        CONVERT(VARCHAR(5), b.booking_from, 108) AS booking_from,
        CONVERT(VARCHAR(5), b.booking_to, 108)   AS booking_to,
        b.status,
        p.full_name AS patient_full_name,
        p.phone     AS patient_phone,
        u.email     AS patient_email
      FROM dbo.Bookings b
      JOIN dbo.Users u
        ON b.patient_user_id = u.user_id
      JOIN dbo.Patients p
        ON p.user_id = u.user_id
      WHERE b.staff_id = ${staff.staff_id}
      ORDER BY b.booking_date, b.booking_from;
    `;
  } else {
    return next(new AppError("Access denied", 403));
  }

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
        SELECT
          work_days,
          CONVERT(VARCHAR(5), work_from, 108) AS work_from,
          CONVERT(VARCHAR(5), work_to, 108) AS work_to
        FROM dbo.Doctors
        WHERE doctor_id = ${doctor_id}
          AND is_verified = 1;
      `
    ).recordset[0];
  } else {
    target = (
      await sql.query`
        SELECT
          work_days,
          CONVERT(VARCHAR(5), work_from, 108) AS work_from,
          CONVERT(VARCHAR(5), work_to, 108) AS work_to
        FROM dbo.Staff
        WHERE staff_id = ${staff_id}
          AND role_title = 'doctor'
          AND is_verified = 1;
      `
    ).recordset[0];
  }

  if (!target) {
    return next(new AppError("Doctor not available", 404));
  }

  const day = new Date(booking_date)
    .toLocaleDateString("en-US", { weekday: "short" })
    .toLowerCase();

  if (!target.work_days.toLowerCase().includes(day)) {
    return res.status(200).json({
      status: "success",
      slots: [],
    });
  }

  const allSlots = generateSlots(target.work_from, target.work_to, 30);

  const bookings = doctor_id
    ? await sql.query`
        SELECT booking_from, booking_to
        FROM dbo.Bookings
        WHERE doctor_id = ${doctor_id}
          AND booking_date = ${booking_date}
          AND status = 'confirmed';
      `
    : await sql.query`
        SELECT booking_from, booking_to
        FROM dbo.Bookings
        WHERE staff_id = ${staff_id}
          AND booking_date = ${booking_date}
          AND status = 'confirmed';
      `;

  const booked = bookings.recordset.map((b) => ({
    from: b.booking_from.toTimeString().slice(0, 5),
    to: b.booking_to.toTimeString().slice(0, 5),
  }));

  const availableSlots = allSlots.filter(
    (slot) => !booked.some((b) => slot.from < b.to && slot.to > b.from),
  );

  res.status(200).json({
    status: "success",
    slots: availableSlots,
  });
});

exports.rejectBooking = catchAsync(async (req, res, next) => {
  const booking_id = Number(req.params.id);
  const user_id = req.user.user_id;
  const role = req.user.user_type;

  if (!booking_id) {
    return next(new AppError("Invalid booking id", 400));
  }

  const booking = (
    await sql.query`
      SELECT
        b.booking_id,
        b.patient_user_id,
        b.doctor_id,
        b.staff_id,
        b.status
      FROM dbo.Bookings b
      WHERE b.booking_id = ${booking_id};
    `
  ).recordset[0];

  if (!booking) {
    return next(new AppError("Booking not found", 404));
  }

  if (booking.status === "cancelled") {
    return next(new AppError("Booking already cancelled", 400));
  }

  if (role === "doctor") {
    const doctor = (
      await sql.query`
        SELECT doctor_id
        FROM dbo.Doctors
        WHERE user_id = ${user_id};
      `
    ).recordset[0];

    if (!doctor || booking.doctor_id !== doctor.doctor_id) {
      return next(new AppError("Access denied", 403));
    }
  }

  if (role === "staff") {
    const staff = (
      await sql.query`
        SELECT staff_id
        FROM dbo.Staff
        WHERE user_id = ${user_id}
          AND role_title = 'doctor';
      `
    ).recordset[0];

    if (!staff || booking.staff_id !== staff.staff_id) {
      return next(new AppError("Access denied", 403));
    }
  }

  await sql.query`
    UPDATE dbo.Bookings
    SET status = 'cancelled'
    WHERE booking_id = ${booking_id};
  `;

  await createNotification({
    user_id: booking.patient_user_id,
    title: "Booking Cancelled ❌",
    message: "Your booking has been cancelled by the doctor.",
  });

  res.status(200).json({
    status: "success",
    message: "Booking cancelled successfully",
  });
});
