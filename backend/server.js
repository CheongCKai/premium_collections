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
  const { name, price, category, emoji, badge, rating, reviews, description } = req.body;
  if (!name || !price || !category || !emoji)
    return res.status(400).json({ error: "name, price, category, and emoji are required." });

  const result = db
    .prepare("INSERT INTO toys (name, price, category, emoji, badge, rating, reviews, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(name, price, category, emoji, badge || null, rating || 0, reviews || 0, description || null);

  const toy = db.prepare("SELECT * FROM toys WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(toy);
});

// PUT /api/toys/:id  (admin only)
app.put("/api/toys/:id", requireAdmin, (req, res) => {
  const { name, price, category, emoji, badge, rating, reviews, description, stock_status } = req.body;
  const toy = db.prepare("SELECT * FROM toys WHERE id = ?").get(req.params.id);
  if (!toy) return res.status(404).json({ error: "Toy not found." });

  db.prepare(
    "UPDATE toys SET name=?, price=?, category=?, emoji=?, badge=?, rating=?, reviews=?, description=?, stock_status=? WHERE id=?"
  ).run(
    name   ?? toy.name,
    price  ?? toy.price,
    category ?? toy.category,
    emoji  ?? toy.emoji,
    badge  !== undefined ? badge : toy.badge,
    rating ?? toy.rating,
    reviews ?? toy.reviews,
    description ?? toy.description,
    stock_status ?? toy.stock_status,
    req.params.id
  );

  res.json(db.prepare("SELECT * FROM toys WHERE id = ?").get(req.params.id));
});

// ── CART ROUTES (requires authentication) ───────────────────────────
app.get("/api/cart", requireAuth, (req, res) => {
  let cart = db.prepare("SELECT id FROM carts WHERE user_id = ?").get(req.user.id);
  if (!cart) {
    const info = db.prepare("INSERT INTO carts (user_id) VALUES (?)").run(req.user.id);
    cart = { id: info.lastInsertRowid };
  }
  const items = db.prepare(`
    SELECT ci.id as cartItemId, ci.qty, t.* FROM cart_items ci
    JOIN toys t ON t.id = ci.toy_id
    WHERE ci.cart_id = ?
  `).all(cart.id);
  res.json({ cartId: cart.id, items });
});

app.post("/api/cart/items", requireAuth, (req, res) => {
  const { toyId, qty = 1 } = req.body;
  if (!toyId) return res.status(400).json({ error: "toyId required" });
  let cart = db.prepare("SELECT id FROM carts WHERE user_id = ?").get(req.user.id);
  if (!cart) {
    const info = db.prepare("INSERT INTO carts (user_id) VALUES (?)").run(req.user.id);
    cart = { id: info.lastInsertRowid };
  }
  const existing = db.prepare("SELECT id, qty FROM cart_items WHERE cart_id = ? AND toy_id = ?").get(cart.id, toyId);
  if (existing) {
    db.prepare("UPDATE cart_items SET qty = ? WHERE id = ?").run(existing.qty + qty, existing.id);
  } else {
    db.prepare("INSERT INTO cart_items (cart_id, toy_id, qty) VALUES (?, ?, ?)").run(cart.id, toyId, qty);
  }
  res.status(201).json({ message: "Item added to cart" });
});

app.put("/api/cart/items/:itemId", requireAuth, (req, res) => {
  const { qty } = req.body;
  if (qty == null) return res.status(400).json({ error: "qty required" });
  db.prepare("UPDATE cart_items SET qty = ? WHERE id = ?").run(qty, req.params.itemId);
  res.json({ message: "Cart item updated" });
});

app.delete("/api/cart/items/:itemId", requireAuth, (req, res) => {
  db.prepare("DELETE FROM cart_items WHERE id = ?").run(req.params.itemId);
  res.json({ message: "Cart item removed" });
});

app.delete("/api/cart", requireAuth, (req, res) => {
  const cart = db.prepare("SELECT id FROM carts WHERE user_id = ?").get(req.user.id);
  if (cart) {
    db.prepare("DELETE FROM cart_items WHERE cart_id = ?").run(cart.id);
  }
  res.json({ message: "Cart cleared" });
});

// ── ORDER ROUTES (requires authentication) ──────────────────────────
app.post("/api/orders", requireAuth, (req, res) => {
  const cart = db.prepare("SELECT id FROM carts WHERE user_id = ?").get(req.user.id);
  if (!cart) return res.status(400).json({ error: "No cart found" });
  const items = db.prepare("SELECT * FROM cart_items WHERE cart_id = ?").all(cart.id);
  if (items.length === 0) return res.status(400).json({ error: "Cart is empty" });
  
  const total = items.reduce((sum, ci) => {
    const toy = db.prepare("SELECT price FROM toys WHERE id = ?").get(ci.toy_id);
    return sum + (toy.price * ci.qty);
  }, 0);

  const orderInfo = db.prepare("INSERT INTO orders (user_id, total_amount, status) VALUES (?, ?, 'completed')").run(req.user.id, total);
  const orderId = orderInfo.lastInsertRowid;
  const insertItem = db.prepare("INSERT INTO order_items (order_id, toy_id, qty, price_at_purchase) VALUES (?, ?, ?, ?)");
  items.forEach(ci => {
    const toy = db.prepare("SELECT price FROM toys WHERE id = ?").get(ci.toy_id);
    insertItem.run(orderId, ci.toy_id, ci.qty, toy.price);
  });
  db.prepare("DELETE FROM cart_items WHERE cart_id = ?").run(cart.id);
  res.status(201).json({ orderId, total });
});

app.get("/api/orders", requireAuth, (req, res) => {
  const orders = db.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC").all(req.user.id);
  const detailed = orders.map(o => {
    const its = db.prepare("SELECT oi.*, t.name, t.price FROM order_items oi JOIN toys t ON t.id = oi.toy_id WHERE oi.order_id = ?").all(o.id);
    return { ...o, items: its };
  });
  res.json(detailed);
});

// ── MESSAGING ROUTES ───────────────────────────────────────────────

// Public/User: Send a message or start a conversation
app.post("/api/contact", (req, res) => {
  const { email, content } = req.body;
  const userId = req.headers.authorization ? null : null; // Placeholder for optional auth
  
  // Use Middleware logic manually if not using requireAuth for optional auth
  let finalUserId = null;
  let guestEmail = email;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret123");
      finalUserId = decoded.id;
      guestEmail = null;
    } catch (e) { /* Ignore invalid token for guest mode */ }
  }

  if (!content) return res.status(400).json({ error: "Content is required" });
  if (!finalUserId && !guestEmail) return res.status(400).json({ error: "Email is required for guests" });

  let conv;
  if (finalUserId) {
    conv = db.prepare("SELECT id FROM conversations WHERE user_id = ?").get(finalUserId);
  } else {
    conv = db.prepare("SELECT id FROM conversations WHERE guest_email = ? AND user_id IS NULL").get(guestEmail);
  }

  if (!conv) {
    const info = db.prepare("INSERT INTO conversations (user_id, guest_email) VALUES (?, ?)").run(finalUserId, guestEmail);
    conv = { id: info.lastInsertRowid };
  }

  db.prepare("INSERT INTO messages (conversation_id, sender_role, content) VALUES (?, ?, ?)")
    .run(conv.id, finalUserId ? 'user' : 'guest', content);
  
  db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(conv.id);

  res.status(201).json({ message: "Message sent", conversationId: conv.id });
});

// User: Get own conversation history
app.get("/api/conversations", requireAuth, (req, res) => {
  const conv = db.prepare("SELECT * FROM conversations WHERE user_id = ?").get(req.user.id);
  if (!conv) return res.json({ messages: [] });
  
  const messages = db.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC").all(conv.id);
  res.json({ conversation: conv, messages });
});

// Admin: List all conversations
app.get("/api/admin/conversations", requireAdmin, (req, res) => {
  const convs = db.prepare(`
    SELECT c.*, u.name as user_name, u.email as user_email,
    (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
    FROM conversations c
    LEFT JOIN users u ON u.id = c.user_id
    ORDER BY updated_at DESC
  `).all();
  res.json(convs);
});

// Admin: Get specific conversation history
app.get("/api/admin/conversations/:id", requireAdmin, (req, res) => {
  const messages = db.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC").all(req.params.id);
  res.json(messages);
});

// Admin: Reply to a conversation
app.post("/api/admin/conversations/:id/reply", requireAdmin, (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: "Content is required" });

  db.prepare("INSERT INTO messages (conversation_id, sender_role, content) VALUES (?, 'admin', ?)")
    .run(req.params.id, content);
  
  db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(req.params.id);

  res.status(201).json({ message: "Reply sent" });
});

// ── ADMIN ROUTES (admin only) ───────────────────────────────────────
app.patch("/api/toys/:id/stock", requireAdmin, (req, res) => {
  const { stock_status } = req.body;
  if (!stock_status) return res.status(400).json({ error: "stock_status required" });
  db.prepare("UPDATE toys SET stock_status = ? WHERE id = ?").run(stock_status, req.params.id);
  res.json(db.prepare("SELECT * FROM toys WHERE id = ?").get(req.params.id));
});

app.delete("/api/toys/:id", requireAdmin, (req, res) => {
  const toy = db.prepare("SELECT * FROM toys WHERE id = ?").get(req.params.id);
  if (!toy) return res.status(404).json({ error: "Toy not found." });
  db.prepare("DELETE FROM toys WHERE id = ?").run(req.params.id);
  res.json({ message: "Toy deleted successfully." });
});

app.get("/api/admin/users", requireAdmin, (req, res) => {
  const users = db.prepare("SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC").all();
  res.json(users);
});

// ── Start Server ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});
