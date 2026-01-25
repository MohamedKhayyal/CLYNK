const { sql } = require("../config/db.Config");
const AppError = require("../utilts/app.Error");
const catchAsync = require("../utilts/catch.Async");

exports.isClinicOwner = catchAsync(async (req, res, next) => {
  const clinicId = Number(req.params.id);
  const userId = req.user.user_id;

  if (!clinicId) {
    return next(new AppError("Invalid clinic id", 400));
  }

  const clinicResult = await sql.query`
    SELECT clinic_id, status
    FROM dbo.Clinics
    WHERE clinic_id = ${clinicId}
      AND owner_user_id = ${userId};
  `;

  if (!clinicResult.recordset.length) {
    return next(new AppError("You are not the clinic owner", 403));
  }

  if (clinicResult.recordset[0].status !== "approved") {
    return next(new AppError("Clinic is not approved yet", 403));
  }

  next();
});
