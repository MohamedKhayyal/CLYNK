const { sql } = require("../config/db.Config");
const AppError = require("../utilts/app.Error");
const catchAsync = require("../utilts/catch.Async");
const { createNotification } = require("../utilts/notification");

const parsePositiveInt = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

const isValidIsoDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
  );
};

const normalizeDateField = (value, fieldName) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  if (typeof value !== "string" || !isValidIsoDate(value)) {
    throw new AppError(`${fieldName} must be in YYYY-MM-DD format`, 400);
  }

  return value;
};

const normalizeTextField = (
  value,
  fieldName,
  { required = false, maxLength = 2000 } = {},
) => {
  if (value === undefined) return undefined;

  if (value === null) {
    if (required) throw new AppError(`${fieldName} is required`, 400);
    return null;
  }

  if (typeof value !== "string") {
    throw new AppError(`${fieldName} must be a string`, 400);
  }

  const normalized = value.trim();

  if (required && !normalized) {
    throw new AppError(`${fieldName} is required`, 400);
  }

  if (!required && !normalized) return null;

  if (normalized.length > maxLength) {
    throw new AppError(`${fieldName} exceeds ${maxLength} characters`, 400);
  }

  return normalized;
};

const ensureDoctorActor = async (userId) => {
  const actor = (
    await sql.query`
      SELECT TOP 1 source
      FROM (
        SELECT 'doctor' AS source
        FROM dbo.Doctors
        WHERE user_id = ${userId}

        UNION ALL

        SELECT 'staff-doctor' AS source
        FROM dbo.Staff
        WHERE user_id = ${userId}
          AND role_title = 'doctor'
      ) actor_roles;
    `
  ).recordset[0];

  if (!actor) {
    throw new AppError("Only doctors can access medical records", 403);
  }
};

const ensurePatientExists = async (patientUserId) => {
  const patient = (
    await sql.query`
      SELECT TOP 1 user_id
      FROM dbo.Users
      WHERE user_id = ${patientUserId}
        AND user_type = 'patient'
        AND is_active = 1;
    `
  ).recordset[0];

  if (!patient) {
    throw new AppError("Patient not found", 404);
  }
};

const ensureDoctorUser = async (doctorUserId) => {
  const doctor = (
    await sql.query`
      SELECT TOP 1 user_id
      FROM dbo.Users
      WHERE user_id = ${doctorUserId}
        AND user_type IN ('doctor', 'staff')
        AND is_active = 1;
    `
  ).recordset[0];

  if (!doctor) {
    throw new AppError("Doctor not found", 404);
  }

  const isDoctorRole = (
    await sql.query`
      SELECT TOP 1 source
      FROM (
        SELECT 'doctor' AS source
        FROM dbo.Doctors
        WHERE user_id = ${doctorUserId}

        UNION ALL

        SELECT 'staff-doctor' AS source
        FROM dbo.Staff
        WHERE user_id = ${doctorUserId}
          AND role_title = 'doctor'
      ) actor_roles;
    `
  ).recordset[0];

  if (!isDoctorRole) {
    throw new AppError("Target user is not a doctor", 400);
  }
};

const hasConfirmedBookingWithDoctor = async (patientUserId, doctorUserId) => {
  const booking = (
    await sql.query`
      SELECT TOP 1 b.booking_id
      FROM dbo.Bookings b
      LEFT JOIN dbo.Doctors d
        ON d.doctor_id = b.doctor_id
      LEFT JOIN dbo.Staff s
        ON s.staff_id = b.staff_id
       AND s.role_title = 'doctor'
      WHERE b.patient_user_id = ${patientUserId}
        AND b.status = 'confirmed'
        AND COALESCE(d.user_id, s.user_id) = ${doctorUserId};
    `
  ).recordset[0];

  return Boolean(booking);
};

const resolveDoctorUserId = async ({ doctor_user_id, doctor_id, staff_id }) => {
  const doctorUserId = parsePositiveInt(doctor_user_id);
  const doctorId = parsePositiveInt(doctor_id);
  const staffId = parsePositiveInt(staff_id);
  const provided = [doctorUserId, doctorId, staffId].filter(Boolean);

  if (provided.length !== 1) {
    throw new AppError(
      "Provide exactly one of doctor_user_id, doctor_id, or staff_id",
      400,
    );
  }

  if (doctorUserId) {
    await ensureDoctorUser(doctorUserId);
    return doctorUserId;
  }

  if (doctorId) {
    const doctor = (
      await sql.query`
        SELECT user_id
        FROM dbo.Doctors
        WHERE doctor_id = ${doctorId};
      `
    ).recordset[0];

    if (!doctor) {
      throw new AppError("Doctor not found", 404);
    }

    return doctor.user_id;
  }

  const staff = (
    await sql.query`
      SELECT user_id
      FROM dbo.Staff
      WHERE staff_id = ${staffId}
        AND role_title = 'doctor';
    `
  ).recordset[0];

  if (!staff) {
    throw new AppError("Staff doctor not found", 404);
  }

  return staff.user_id;
};

const hasAnyApprovedPermission = async (patientUserId, doctorUserId) => {
  const permission = (
    await sql.query`
      SELECT TOP 1 p.permission_id
      FROM dbo.PatientDoctorPermissions p
      WHERE p.patient_user_id = ${patientUserId}
        AND p.doctor_user_id = ${doctorUserId}
        AND p.is_active = 1;
    `
  ).recordset[0];

  return Boolean(permission);
};

const mapProfile = (profile, patientUserId) => ({
  patient_user_id: patientUserId,
  allergies: profile?.allergies ?? null,
  chronic_conditions: profile?.chronic_conditions ?? null,
  medical_history: profile?.medical_history ?? null,
  current_medications: profile?.current_medications ?? null,
  notes: profile?.notes ?? null,
  // created_at: profile?.created_at ?? null,
  // updated_at: profile?.updated_at ?? null,
});

const getPatientProfileAndPrescriptions = async (patientUserId) => {
  const profile = (
    await sql.query`
      SELECT
        patient_user_id,
        allergies,
        chronic_conditions,
        medical_history,
        current_medications,
        notes
      FROM dbo.MedicalProfiles
      WHERE patient_user_id = ${patientUserId};
    `
  ).recordset[0];

  const prescriptions = await sql.query`
    SELECT
      p.prescription_id,
      p.patient_user_id,
      p.doctor_user_id,
      p.diagnosis,
      p.medications,
      p.instructions,
      p.follow_up_date,
      COALESCE(d.full_name, s.full_name) AS doctor_name
    FROM dbo.Prescriptions p
    LEFT JOIN dbo.Doctors d
      ON d.user_id = p.doctor_user_id
    LEFT JOIN dbo.Staff s
      ON s.user_id = p.doctor_user_id
     AND s.role_title = 'doctor'
    WHERE p.patient_user_id = ${patientUserId}
    ORDER BY p.created_at DESC;
  `;

  return {
    profile: mapProfile(profile, patientUserId),
    prescriptions: prescriptions.recordset,
  };
};

exports.getMyMedicalProfile = catchAsync(async (req, res, next) => {
  const patientUserId = req.user.user_id;

  const medical = await getPatientProfileAndPrescriptions(patientUserId);

  const permissions = await sql.query`
    SELECT
      p.permission_id,
      p.doctor_user_id,
      p.approved_at,
      p.is_active,
      COALESCE(d.full_name, s.full_name) AS doctor_name
    FROM dbo.PatientDoctorPermissions p
    LEFT JOIN dbo.Doctors d
      ON d.user_id = p.doctor_user_id
    LEFT JOIN dbo.Staff s
      ON s.user_id = p.doctor_user_id
     AND s.role_title = 'doctor'
    WHERE p.patient_user_id = ${patientUserId}
      AND p.is_active = 1
    ORDER BY p.approved_at DESC;
  `;

  res.status(200).json({
    status: "success",
    data: {
      ...medical,
      permissions: permissions.recordset,
    },
  });
});

exports.upsertMyMedicalProfile = catchAsync(async (req, res, next) => {
  const patientUserId = req.user.user_id;

  const payload = {
    allergies: normalizeTextField(req.body.allergies, "allergies", {
      maxLength: 500,
    }),
    chronic_conditions: normalizeTextField(
      req.body.chronic_conditions,
      "chronic_conditions",
      { maxLength: 1000 },
    ),
    medical_history: normalizeTextField(
      req.body.medical_history,
      "medical_history",
      { maxLength: 2000 },
    ),
    current_medications: normalizeTextField(
      req.body.current_medications,
      "current_medications",
      { maxLength: 2000 },
    ),
    notes: normalizeTextField(req.body.notes, "notes", { maxLength: 2000 }),
  };

  const hasAnyChange = Object.values(payload).some((value) => value !== undefined);
  if (!hasAnyChange) {
    return next(new AppError("At least one profile field is required", 400));
  }

  const current = (
    await sql.query`
      SELECT
        allergies,
        chronic_conditions,
        medical_history,
        current_medications,
        notes
      FROM dbo.MedicalProfiles
      WHERE patient_user_id = ${patientUserId};
    `
  ).recordset[0];

  if (current) {
    const nextProfile = {
      allergies:
        payload.allergies !== undefined ? payload.allergies : current.allergies,
      chronic_conditions:
        payload.chronic_conditions !== undefined
          ? payload.chronic_conditions
          : current.chronic_conditions,
      medical_history:
        payload.medical_history !== undefined
          ? payload.medical_history
          : current.medical_history,
      current_medications:
        payload.current_medications !== undefined
          ? payload.current_medications
          : current.current_medications,
      notes: payload.notes !== undefined ? payload.notes : current.notes,
    };

    await sql.query`
      UPDATE dbo.MedicalProfiles
      SET
        allergies = ${nextProfile.allergies},
        chronic_conditions = ${nextProfile.chronic_conditions},
        medical_history = ${nextProfile.medical_history},
        current_medications = ${nextProfile.current_medications},
        notes = ${nextProfile.notes},
        updated_at = SYSDATETIME()
      WHERE patient_user_id = ${patientUserId};
    `;
  } else {
    await sql.query`
      INSERT INTO dbo.MedicalProfiles (
        patient_user_id,
        allergies,
        chronic_conditions,
        medical_history,
        current_medications,
        notes
      )
      VALUES (
        ${patientUserId},
        ${payload.allergies ?? null},
        ${payload.chronic_conditions ?? null},
        ${payload.medical_history ?? null},
        ${payload.current_medications ?? null},
        ${payload.notes ?? null}
      );
    `;
  }

  const updated = (
    await sql.query`
      SELECT
        patient_user_id,
        allergies,
        chronic_conditions,
        medical_history,
        current_medications,
        notes
      FROM dbo.MedicalProfiles
      WHERE patient_user_id = ${patientUserId};
    `
  ).recordset[0];

  res.status(200).json({
    status: "success",
    profile: updated,
  });
});

exports.approveDoctorAccess = catchAsync(async (req, res, next) => {
  const patientUserId = req.user.user_id;
  const doctorUserId = await resolveDoctorUserId(req.body);

  const hasBooking = await hasConfirmedBookingWithDoctor(
    patientUserId,
    doctorUserId,
  );

  if (!hasBooking) {
    return next(
      new AppError("You can approve only doctors you booked with", 403),
    );
  }

  const existing = (
    await sql.query`
      SELECT
        permission_id,
        is_active
      FROM dbo.PatientDoctorPermissions
      WHERE patient_user_id = ${patientUserId}
        AND doctor_user_id = ${doctorUserId};
    `
  ).recordset[0];

  let permission;

  if (existing && existing.is_active) {
    permission = (
      await sql.query`
        SELECT
          permission_id,
          patient_user_id,
          doctor_user_id,
          is_active,
          approved_at,
          revoked_at,
          updated_at
        FROM dbo.PatientDoctorPermissions
        WHERE permission_id = ${existing.permission_id};
      `
    ).recordset[0];
  } else if (existing && !existing.is_active) {
    permission = (
      await sql.query`
        UPDATE dbo.PatientDoctorPermissions
        SET
          is_active = 1,
          approved_at = SYSDATETIME(),
          revoked_at = NULL,
          updated_at = SYSDATETIME()
        OUTPUT
          INSERTED.permission_id,
          INSERTED.patient_user_id,
          INSERTED.doctor_user_id,
          INSERTED.is_active,
          INSERTED.approved_at,
          INSERTED.revoked_at,
          INSERTED.updated_at
        WHERE permission_id = ${existing.permission_id};
      `
    ).recordset[0];
  } else {
    permission = (
      await sql.query`
        INSERT INTO dbo.PatientDoctorPermissions (
          patient_user_id,
          doctor_user_id
        )
        OUTPUT
          INSERTED.permission_id,
          INSERTED.patient_user_id,
          INSERTED.doctor_user_id,
          INSERTED.is_active,
          INSERTED.approved_at,
          INSERTED.revoked_at,
          INSERTED.updated_at
        VALUES (
          ${patientUserId},
          ${doctorUserId}
        );
      `
    ).recordset[0];
  }

  await createNotification({
    user_id: doctorUserId,
    title: "Medical profile access approved",
    message: "Patient approved access to medical profile.",
  });

  res.status(200).json({
    status: "success",
    permission,
  });
});

exports.revokeDoctorAccess = catchAsync(async (req, res, next) => {
  const patientUserId = req.user.user_id;
  const permissionId = parsePositiveInt(req.params.id);

  if (!permissionId) {
    return next(new AppError("Invalid permission id", 400));
  }

  const permission = (
    await sql.query`
      SELECT
        permission_id,
        doctor_user_id,
        is_active
      FROM dbo.PatientDoctorPermissions
      WHERE permission_id = ${permissionId}
        AND patient_user_id = ${patientUserId};
    `
  ).recordset[0];

  if (!permission) {
    return next(new AppError("Permission not found", 404));
  }

  if (!permission.is_active) {
    return next(new AppError("Permission is already revoked", 400));
  }

  const revoked = (
    await sql.query`
      UPDATE dbo.PatientDoctorPermissions
      SET
        is_active = 0,
        revoked_at = SYSDATETIME(),
        updated_at = SYSDATETIME()
      OUTPUT
        INSERTED.permission_id,
        INSERTED.patient_user_id,
        INSERTED.doctor_user_id,
        INSERTED.is_active,
        INSERTED.approved_at,
        INSERTED.revoked_at,
        INSERTED.updated_at
      WHERE permission_id = ${permissionId};
    `
  ).recordset[0];

  await createNotification({
    user_id: permission.doctor_user_id,
    title: "Medical profile access revoked",
    message: "Patient revoked access to medical profile.",
  });

  res.status(200).json({
    status: "success",
    permission: revoked,
  });
});

exports.getPatientMedicalProfile = catchAsync(async (req, res, next) => {
  const patientUserId = parsePositiveInt(req.params.patientUserId);

  if (!patientUserId) {
    return next(new AppError("Invalid patient user id", 400));
  }

  await ensureDoctorActor(req.user.user_id);
  await ensurePatientExists(patientUserId);

  const hasAccess = await hasAnyApprovedPermission(patientUserId, req.user.user_id);
  if (!hasAccess) {
    return next(
      new AppError("Patient approval is required before viewing this profile", 403),
    );
  }

  const medical = await getPatientProfileAndPrescriptions(patientUserId);

  res.status(200).json({
    status: "success",
    data: medical,
  });
});

exports.createPrescription = catchAsync(async (req, res, next) => {
  await ensureDoctorActor(req.user.user_id);

  const patientUserId = parsePositiveInt(req.body.patient_user_id);
  const diagnosis = normalizeTextField(req.body.diagnosis, "diagnosis", {
    required: true,
    maxLength: 1000,
  });
  const medications = normalizeTextField(req.body.medications, "medications", {
    required: true,
    maxLength: 8000,
  });
  const instructions = normalizeTextField(req.body.instructions, "instructions", {
    maxLength: 2000,
  });
  const followUpDate = normalizeDateField(req.body.follow_up_date, "follow_up_date");

  if (!patientUserId) {
    return next(new AppError("patient_user_id is required", 400));
  }

  await ensurePatientExists(patientUserId);

  const hasBooking = await hasConfirmedBookingWithDoctor(
    patientUserId,
    req.user.user_id,
  );

  if (!hasBooking) {
    return next(
      new AppError("You can write prescriptions only for your bookings", 403),
    );
  }

  const hasAccess = await hasAnyApprovedPermission(
    patientUserId,
    req.user.user_id,
  );

  if (!hasAccess) {
    return next(
      new AppError("Patient approval is required before creating prescription", 403),
    );
  }

  const prescription = (
    await sql.query`
      INSERT INTO dbo.Prescriptions (
        patient_user_id,
        doctor_user_id,
        diagnosis,
        medications,
        instructions,
        follow_up_date
      )
      OUTPUT
        INSERTED.prescription_id,
        INSERTED.patient_user_id,
        INSERTED.doctor_user_id,
        INSERTED.diagnosis,
        INSERTED.medications,
        INSERTED.instructions,
        INSERTED.follow_up_date,
        INSERTED.created_at,
        INSERTED.updated_at
      VALUES (
        ${patientUserId},
        ${req.user.user_id},
        ${diagnosis},
        ${medications},
        ${instructions ?? null},
        ${followUpDate}
      );
    `
  ).recordset[0];

  res.status(201).json({
    status: "success",
    prescription,
  });
});

exports.updatePrescription = catchAsync(async (req, res, next) => {
  await ensureDoctorActor(req.user.user_id);

  const prescriptionId = parsePositiveInt(req.params.id);
  if (!prescriptionId) {
    return next(new AppError("Invalid prescription id", 400));
  }

  const payload = {
    diagnosis: normalizeTextField(req.body.diagnosis, "diagnosis", {
      maxLength: 1000,
    }),
    medications: normalizeTextField(req.body.medications, "medications", {
      maxLength: 8000,
    }),
    instructions: normalizeTextField(req.body.instructions, "instructions", {
      maxLength: 2000,
    }),
    follow_up_date: normalizeDateField(req.body.follow_up_date, "follow_up_date"),
  };

  const hasAnyChange = Object.values(payload).some((value) => value !== undefined);
  if (!hasAnyChange) {
    return next(new AppError("At least one field is required for update", 400));
  }

  const current = (
    await sql.query`
      SELECT
        prescription_id,
        patient_user_id,
        doctor_user_id,
        diagnosis,
        medications,
        instructions,
        follow_up_date
      FROM dbo.Prescriptions
      WHERE prescription_id = ${prescriptionId};
    `
  ).recordset[0];

  if (!current) {
    return next(new AppError("Prescription not found", 404));
  }

  if (current.doctor_user_id !== req.user.user_id) {
    return next(new AppError("Only the prescribing doctor can edit this record", 403));
  }

  const hasBooking = await hasConfirmedBookingWithDoctor(
    current.patient_user_id,
    req.user.user_id,
  );

  if (!hasBooking) {
    return next(
      new AppError("You can update prescriptions only for your bookings", 403),
    );
  }

  const hasAccess = await hasAnyApprovedPermission(
    current.patient_user_id,
    req.user.user_id,
  );

  if (!hasAccess) {
    return next(
      new AppError("Patient approval is required before updating prescription", 403),
    );
  }

  const nextState = {
    diagnosis:
      payload.diagnosis !== undefined ? payload.diagnosis : current.diagnosis,
    medications:
      payload.medications !== undefined ? payload.medications : current.medications,
    instructions:
      payload.instructions !== undefined ? payload.instructions : current.instructions,
    follow_up_date:
      payload.follow_up_date !== undefined
        ? payload.follow_up_date
        : current.follow_up_date,
  };

  const updated = (
    await sql.query`
      UPDATE dbo.Prescriptions
      SET
        diagnosis = ${nextState.diagnosis},
        medications = ${nextState.medications},
        instructions = ${nextState.instructions},
        follow_up_date = ${nextState.follow_up_date},
        updated_at = SYSDATETIME()
      OUTPUT
        INSERTED.prescription_id,
        INSERTED.patient_user_id,
        INSERTED.doctor_user_id,
        INSERTED.diagnosis,
        INSERTED.medications,
        INSERTED.instructions,
        INSERTED.follow_up_date,
        INSERTED.created_at,
        INSERTED.updated_at
      WHERE prescription_id = ${prescriptionId};
    `
  ).recordset[0];

  res.status(200).json({
    status: "success",
    prescription: updated,
  });
});
