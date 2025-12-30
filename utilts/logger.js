const { createLogger, format, transports } = require("winston");

const onlyLevel = (level) =>
  format((info) => {
    return info.level === level ? info : false;
  });

const logger = createLogger({
  level: "debug",
  format: format.combine(
    format.timestamp({ format: "YYYY/MM/DD HH:mm:ss" }),
    format.errors({ stack: true }),
    format.printf(({ timestamp, level, message, stack }) => {
      return `${timestamp} | ${level.toUpperCase()} | ${message}${
        stack ? `\n${stack}` : ""
      }`;
    })
  ),
  transports: [
    new transports.File({
      filename: "logs/error.log",
      level: "error",
      format: onlyLevel("error")(),
    }),
    new transports.File({
      filename: "logs/warn.log",
      level: "warn",
      format: onlyLevel("warn")(),
    }),
    new transports.File({
      filename: "logs/info.log",
      level: "info",
      format: onlyLevel("info")(),
    }),
    new transports.File({
      filename: "logs/debug.log",
      level: "debug",
      format: onlyLevel("debug")(),
    }),
    new transports.File({ filename: "logs/combined.log" }),
  ],
});

module.exports = logger;
