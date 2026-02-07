const { sql } = require("../config/db.Config");
const catchAsync = require("../utilts/catch.Async");

exports.getDoctors = catchAsync(async (req, res) => {
  const { specialist } = req.query;

  let query = `
    SELECT
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
    FROM dbo.Doctors d
    JOIN dbo.Users u
      ON d.user_id = u.user_id
    WHERE d.is_verified = 1
  `;

  if (specialist) {
    query += ` AND d.specialist = @specialist`;
  }

  const request = new sql.Request();

  if (specialist) {
    request.input("specialist", sql.VarChar, specialist);
  }

  const result = await request.query(query);

  res.status(200).json({
    status: "success",
    results: result.recordset.length,
    doctors: result.recordset,
  });
});
