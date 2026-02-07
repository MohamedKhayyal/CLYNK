const AppError = require("../utilts/app.Error");

const EMAIL_REGEX = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
const ALLOWED_SIGNUP_ROLES = ["patient", "doctor", "staff"];
const STAFF_ROLES = ["doctor", "nurse", "receptionist"];

exports.signupValidation = (req, res, next) => {
  const { email, password, user_type, profile } = req.body;

  if (!email || !password || !user_type) {
    return next(
      new AppError("Email, password and user_type are required", 400),
    );
  }

  if (!EMAIL_REGEX.test(email)) {
    return next(new AppError("Invalid email format", 400));
  }

  if (!ALLOWED_SIGNUP_ROLES.includes(user_type)) {
    return next(new AppError("Invalid user type", 400));
  }

  if (!profile || typeof profile !== "object") {
    return next(new AppError("Profile data is required", 400));
  }

  if (user_type === "patient") {
    if (!profile.full_name) {
      return next(new AppError("Patient full_name is required", 400));
    }
  }

  if (user_type === "doctor") {
    const { full_name, license_number, specialist, work_days } = profile;

    if (!full_name || !license_number || !specialist || !work_days) {
      return next(
        new AppError(
          "Doctor full_name, license_number, specialist and work_days are required",
          400,
        ),
      );
    }
  }

  if (user_type === "staff") {
    const { full_name, clinic_id, role_title, specialist } = profile;

    if (!full_name || !clinic_id || !role_title) {
      return next(
        new AppError(
          "Staff full_name, clinic_id and role_title are required",
          400,
        ),
      );
    }

    if (!STAFF_ROLES.includes(role_title)) {
      return next(new AppError("Invalid staff role_title", 400));
    }

    if (role_title === "doctor" && !specialist) {
      return next(
        new AppError("Specialist is required when staff role is doctor", 400),
      );
    }
  }

  next();
};

exports.loginValidation = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError("Email and password are required", 400));
  }

  if (!EMAIL_REGEX.test(email)) {
    return next(new AppError("Invalid email format", 400));
  }

  next();
};

exports.refreshValidation = (req, res, next) => {
  if (!req.cookies || !req.cookies.refresh_token) {
    return next(new AppError("Refresh token missing", 401));
  }

  next();
};
