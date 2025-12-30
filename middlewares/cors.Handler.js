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

    console.log(`❌ CORS denied request from origin: ${origin}`);
    const err = new AppError("CORS Policy: Origin not allowed", 403);
    return callback(err);
  },

  credentials: true,

  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],

  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],

  optionsSuccessStatus: 200,
};

const corsHandler = cors(corsOptions);

module.exports = corsHandler;
