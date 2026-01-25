const bcrypt = require("bcryptjs");
const { sql } = require("../config/db.Config");
const catchAsync = require("../utilts/catch.Async");
const AppError = require("../utilts/app.Error");
const logger = require("../utilts/logger");

const EMAIL_REGEX = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;

exports.createStaffForClinic = catchAsync(async (req, res, next) => {
  const clinicId = Number(req.params.id);
  const { email, password, full_name, role_title } = req.body;
  const ownerUserId = req.user.user_id;

  logger.info(`Create staff for clinic ${clinicId} by user ${ownerUserId}`);

  if (!email || !password || !full_name) {
    return next(
      new AppError("Email, password and full_name are required", 400)
    );
  }

  if (!EMAIL_REGEX.test(email)) {
    return next(new AppError("Invalid email format", 400));
  }

  const clinicResult = await sql.query`
    SELECT clinic_id FROM dbo.Clinics
    WHERE clinic_id = ${clinicId}
      AND owner_user_id = ${ownerUserId}
      AND status = 'approved';
  `;

  if (!clinicResult.recordset.length) {
    return next(
      new AppError("Clinic not found or not approved or not owned by you", 403)
    );
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
    /* Users */
    const userResult = await transaction.request().query`
      INSERT INTO dbo.Users (email, password, user_type)
      OUTPUT INSERTED.user_id
      VALUES (${email}, ${hashedPassword}, 'staff');
    `;

    const userId = userResult.recordset[0].user_id;

    /* Staff */
    await transaction.request().query`
      INSERT INTO dbo.Staff
        (user_id, clinic_id, full_name, role_title)
      VALUES
        (${userId}, ${clinicId}, ${full_name}, ${role_title});
    `;

    await transaction.commit();

    logger.info(`Staff created (user ${userId}) for clinic ${clinicId}`);

    res.status(201).json({
      status: "success",
      staff: {
        user_id: userId,
        email,
        clinic_id: clinicId,
        full_name,
        role_title,
      },
    });
  } catch (err) {
    await transaction.rollback();
    logger.error(`Create staff failed: ${err.message}`);
    next(err);
  }
});
