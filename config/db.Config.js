const sql = require("mssql");

const config = {
  server: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

const connectDB = async () => {
  try {
    await sql.connect(config);
    console.log("✅ SQL Server connected successfully (SQL Auth)");
  } catch (error) {
    console.log("❌ SQL Server connection failed", error);
    process.exit(1);
  }
};

module.exports = { sql, connectDB };
