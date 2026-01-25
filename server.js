const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const { connectDB } = require("./config/db.Config");
const corsHandler = require("./middlewares/cors.Handler");
const logger = require("./utilts/logger");

const AppError = require("./utilts/app.Error");
const errorHandler = require("./middlewares/error.Handler");

const authRoute = require("./routes/auth.Route");
const userRoute = require("./routes/user.Routes");
const adminClinicRoute = require("./routes/admin.Clinic.Routes");
const clinicRoute = require("./routes/clinic.Routes");
const staffRoute = require("./routes/staff.Route");
const doctorRoute = require("./routes/doctor.Route");

const { globalLimiter } = require("./middlewares/rateLimiters");

process.on("uncaughtException", (err) => {
  logger.error("UNCAUGHT EXCEPTION! Shutting down...");
  logger.error(err);
  process.exit(1);
});

const app = express();
const PORT = process.env.PORT || 3001;

app.use(corsHandler);
app.use(globalLimiter);

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());
app.use("/img", express.static(path.join(__dirname, "uploads")));

connectDB();

/* 🚏 Routes */
app.use("/api/auth", authRoute);
app.use("/api/user", userRoute);
app.use("/api/admin", adminClinicRoute);
app.use("/api/clinic", clinicRoute);
app.use("/api/staff", staffRoute);
app.use("/api/doctors", doctorRoute);

app.use((req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server`, 404));
});

app.use(errorHandler);

const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

process.on("unhandledRejection", (err) => {
  logger.error("UNHANDLED REJECTION! Shutting down...");
  logger.error(err);
  server.close(() => process.exit(1));
});
