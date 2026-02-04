const { sql } = require("../config/db.Config");

exports.createNotification = async ({ user_id, title, message }) => {
  await sql.query`
    INSERT INTO dbo.Notifications (user_id, title, message)
    VALUES (${user_id}, ${title}, ${message});
  `;
};
