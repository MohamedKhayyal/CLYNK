const cors = require("cors");
const AppError = require("../utilts/app.Error");

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : [];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(
      new AppError("CORS policy: Origin not allowed", 403),
      false
    );
  },

  credentials: true, 

  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
  ],

  exposedHeaders: ["Set-Cookie"],

  optionsSuccessStatus: 204, 
};

module.exports = cors(corsOptions);
