function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return String(forwarded).split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || "unknown";
}

function logDenied(req, requiredRole) {
  const payload = {
    timestamp: new Date().toISOString(),
    userId: req.user?._id ? String(req.user._id) : null,
    userRole: req.user?.role || null,
    method: req.method,
    path: req.originalUrl,
    requiredRole,
    ip: getClientIp(req),
  };

  console.warn(JSON.stringify(payload));
}

function wantsJson(req) {
  return (
    req.method !== "GET" ||
    req.originalUrl.startsWith("/api") ||
    req.accepts(["html", "json"]) === "json"
  );
}

function deny(req, res, status, message) {
  if (wantsJson(req)) {
    return res.status(status).json({ error: message });
  }

  if (status === 401) {
    return res.redirect("/auth/login");
  }

  return res.status(403).render("403", {
    title: "Forbidden",
    path: req.originalUrl,
  });
}

function requireAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  logDenied(req, "AUTHENTICATED");
  return deny(req, res, 401, "Login required.");
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      logDenied(req, allowedRoles.join(" | "));
      return deny(req, res, 401, "Login required.");
    }

    if (!allowedRoles.includes(req.user.role)) {
      logDenied(req, allowedRoles.join(" | "));
      return deny(req, res, 403, "Insufficient privileges.");
    }

    return next();
  };
}

module.exports = {
  requireAuth,
  requireRole,
};