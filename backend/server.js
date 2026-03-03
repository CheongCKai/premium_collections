require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");

const db                       = require("./db");
const { requireAuth, requireAdmin } = require("./middleware/auth");

const app = express();
app.use(cors());
app.use(express.json());

// ── Helpers ─────────────────────────────────────────────────────────
const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

// ── Health ───────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Backend is running!" });
});

// ══════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ══════════════════════════════════════════════════════════════════════

// POST /api/auth/register
app.post("/api/auth/register", (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ error: "Name, email and password are required." });

  if (password.length < 6)
    return res.status(400).json({ error: "Password must be at least 6 characters." });

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing)
    return res.status(409).json({ error: "An account with this email already exists." });

  const password_hash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'user')")
    .run(name, email, password_hash);

  const user = db
    .prepare("SELECT id, name, email, role, created_at FROM users WHERE id = ?")
    .get(result.lastInsertRowid);

  const token = signToken(user);
  res.status(201).json({ token, user });
});

// POST /api/auth/login
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required." });

  const user = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email);

  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: "Invalid email or password." });

  const token = signToken(user);
  const { password_hash, ...safeUser } = user; // never send hash to client
  res.json({ token, user: safeUser });
});

// GET /api/auth/me  (protected)
app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ══════════════════════════════════════════════════════════════════════
// TOYS ROUTES
// ══════════════════════════════════════════════════════════════════════

// GET /api/toys  (public)
app.get("/api/toys", (req, res) => {
  const toys = db.prepare("SELECT * FROM toys ORDER BY id").all();
  res.json(toys);
});

// POST /api/toys  (admin only)
app.post("/api/toys", requireAdmin, (req, res) => {
  const { name, price, category, emoji, badge, rating, reviews } = req.body;
  if (!name || !price || !category || !emoji)
    return res.status(400).json({ error: "name, price, category, and emoji are required." });

  const result = db
    .prepare("INSERT INTO toys (name, price, category, emoji, badge, rating, reviews) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(name, price, category, emoji, badge || null, rating || 0, reviews || 0);

  const toy = db.prepare("SELECT * FROM toys WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(toy);
});

// PUT /api/toys/:id  (admin only)
app.put("/api/toys/:id", requireAdmin, (req, res) => {
  const { name, price, category, emoji, badge, rating, reviews } = req.body;
  const toy = db.prepare("SELECT * FROM toys WHERE id = ?").get(req.params.id);
  if (!toy) return res.status(404).json({ error: "Toy not found." });

  db.prepare(
    "UPDATE toys SET name=?, price=?, category=?, emoji=?, badge=?, rating=?, reviews=? WHERE id=?"
  ).run(
    name   ?? toy.name,
    price  ?? toy.price,
    category ?? toy.category,
    emoji  ?? toy.emoji,
    badge  !== undefined ? badge : toy.badge,
    rating ?? toy.rating,
    reviews ?? toy.reviews,
    req.params.id
  );

  res.json(db.prepare("SELECT * FROM toys WHERE id = ?").get(req.params.id));
});

// DELETE /api/toys/:id  (admin only)
app.delete("/api/toys/:id", requireAdmin, (req, res) => {
  const toy = db.prepare("SELECT * FROM toys WHERE id = ?").get(req.params.id);
  if (!toy) return res.status(404).json({ error: "Toy not found." });
  db.prepare("DELETE FROM toys WHERE id = ?").run(req.params.id);
  res.json({ message: "Toy deleted successfully." });
});

// ══════════════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ══════════════════════════════════════════════════════════════════════

// GET /api/admin/users  (admin only)
app.get("/api/admin/users", requireAdmin, (req, res) => {
  const users = db
    .prepare("SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC")
    .all();
  res.json(users);
});

// ── Start Server ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});