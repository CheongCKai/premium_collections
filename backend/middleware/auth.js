const jwt = require("jsonwebtoken");
const db  = require("../db");

// Verify JWT and attach req.user
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided. Please log in." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Refresh user from DB to ensure role/existence is current
    const user = db.prepare("SELECT id, username, email, role FROM users WHERE id = ?").get(decoded.id);
    if (!user) return res.status(401).json({ error: "User not found." });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
};

// Admin-only guard
const requireAdmin = (req, res, next) => {
  requireAuth(req, res, () => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required." });
    }
    next();
  });
};

// Operator or Admin guard
const requireOperator = (req, res, next) => {
  requireAuth(req, res, () => {
    if (req.user.role !== "admin" && req.user.role !== "operator") {
      return res.status(403).json({ error: "Operator access required." });
    }
    next();
  });
};

module.exports = { requireAuth, requireAdmin, requireOperator };
