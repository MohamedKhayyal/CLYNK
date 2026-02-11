const {
  logAuditEvent,
  sanitizeAuditBody,
} = require("../utilts/audit.Logger");

const AUDIT_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

module.exports = (req, res, next) => {
  const startedAt = Date.now();

  res.on("finish", () => {
    if (!req.originalUrl.startsWith("/api")) {
      return;
    }

    if (!AUDIT_METHODS.has(req.method)) {
      return;
    }

    logAuditEvent({
      event_type: "http_request",
      action: `${req.method} ${req.originalUrl}`,
      method: req.method,
      path: req.originalUrl,
      status_code: res.statusCode,
      duration_ms: Date.now() - startedAt,
      actor_user_id: req.user?.user_id || null,
      actor_role: req.user?.user_type || "guest",
      ip: req.ip,
      user_agent: req.get("user-agent") || null,
      query: sanitizeAuditBody(req.query || {}),
      body: sanitizeAuditBody(req.body || {}),
    });
  });

  next();
};
