const { sql } = require("../config/db.Config");
const catchAsync = require("../utilts/catch.Async");

exports.getDoctors = catchAsync(async (req, res) => {
  const result = await sql.query`
    SELECT
      d.doctor_id,
      d.full_name,
      d.gender,
      d.years_of_experience,
      d.bio
    FROM dbo.Doctors d
    WHERE d.is_verified = 1;
  `;

  res.status(200).json({
    status: "success",
    results: result.recordset.length,
    doctors: result.recordset,
  });
});
