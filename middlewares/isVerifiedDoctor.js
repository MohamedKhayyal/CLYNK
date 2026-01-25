const { sql } = require("../config/db.Config");
const AppError = require("../utilts/app.Error");
const catchAsync = require("../utilts/catch.Async");

exports.isVerifiedDoctor = catchAsync(async (req, res, next) => {
  const userId = req.user.user_id;

  const result = await sql.query`
    SELECT is_verified
    FROM dbo.Doctors
    WHERE user_id = ${userId};
  `;

  const doctor = result.recordset[0];

  if (!doctor) {
    return next(new AppError("Doctor profile not found", 404));
  }

  if (!doctor.is_verified) {
    return next(
      new AppError("Your account must be verified before creating a clinic", 403)
    );
  }

  next();
});
