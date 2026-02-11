const { sql } = require("../config/db.Config");
const catchAsync = require("../utilts/catch.Async");

exports.getMyNotifications = catchAsync(async (req, res, next) => {
  const userId = req.user.user_id;

  const result = await sql.query`
    SELECT
      notification_id,
      title,
      message,
      is_read
    FROM dbo.Notifications
    WHERE user_id = ${userId}
    ORDER BY created_at DESC;
  `;

  res.status(200).json({
    status: "success",
    results: result.recordset.length,
    notifications: result.recordset,
  });
});

exports.markAsRead = catchAsync(async (req, res, next) => {
  const notificationId = Number(req.params.id);
  const userId = req.user.user_id;

  await sql.query`
    UPDATE dbo.Notifications
    SET is_read = 1
    WHERE notification_id = ${notificationId}
      AND user_id = ${userId};
  `;

  res.status(200).json({
    status: "success",
    message: "تم تعليم الإشعار كمقروء",
  });
});
