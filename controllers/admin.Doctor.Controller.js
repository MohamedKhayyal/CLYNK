const { sql } = require("../config/db.Config");
const catchAsync = require("../utilts/catch.Async");
const AppError = require("../utilts/app.Error");
const logger = require("../utilts/logger");

exports.verifyDoctor = catchAsync(async (req, res, next) => {
  const doctorId = Number(req.params.id);
  const { is_verified } = req.body;
  const adminUserId = req.user.user_id;

  if (!doctorId) {
    return next(new AppError("Invalid doctor id", 400));
  }

  if (typeof is_verified !== "boolean") {
    return next(new AppError("is_verified must be boolean", 400));
  }

  const adminResult = await sql.query`
    SELECT admin_id FROM dbo.Admins WHERE user_id = ${adminUserId};
  `;

  if (!adminResult.recordset.length) {
    return next(new AppError("Admin profile not found", 403));
  }

  const result = await sql.query`
    UPDATE dbo.Doctors
    SET is_verified = ${is_verified ? 1 : 0}
    WHERE doctor_id = ${doctorId};
  `;

  if (result.rowsAffected[0] === 0) {
    return next(new AppError("Doctor not found", 404));
  }

  logger.warn(
    `Doctor ${doctorId} verification set to ${is_verified} by admin user ${adminUserId}`,
  );

  res.status(200).json({
    status: "success",
    message: `Doctor ${is_verified ? "verified" : "unverified"} successfully`,
    doctor: {
      doctor_id: doctorId,
      is_verified,
    },
  });
});
