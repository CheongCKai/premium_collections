const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const path = require("path");

const db = new Database(path.join(__dirname, "database.sqlite"));

// Enable WAL mode for better performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ── Create Tables ──────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    username     TEXT    NOT NULL UNIQUE,
    email        TEXT    NOT NULL UNIQUE,
    password_hash TEXT   NOT NULL,
    role         TEXT    NOT NULL DEFAULT 'user',
    must_reset_password INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS toys (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL,
    price        REAL    NOT NULL,
    category     TEXT    NOT NULL,
    emoji        TEXT    NOT NULL,
    badge        TEXT,
    rating       REAL    NOT NULL DEFAULT 0,
    reviews      INTEGER NOT NULL DEFAULT 0,
    stock_status TEXT    NOT NULL DEFAULT 'available',
    description  TEXT
  );

  CREATE TABLE IF NOT EXISTS carts (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   INTEGER NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS cart_items (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    cart_id INTEGER NOT NULL,
    toy_id  INTEGER NOT NULL,
    qty     INTEGER NOT NULL,
    FOREIGN KEY(cart_id) REFERENCES carts(id) ON DELETE CASCADE,
    FOREIGN KEY(toy_id)  REFERENCES toys(id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL,
    total_amount REAL    NOT NULL,
    status       TEXT    NOT NULL DEFAULT 'pending', -- e.g., pending, completed, cancelled
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   INTEGER NOT NULL,
    toy_id     INTEGER NOT NULL,
    qty        INTEGER NOT NULL,
    price_at_purchase REAL NOT NULL, -- Price of the toy at the time of order
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY(toy_id)   REFERENCES toys(id)
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER, -- Null for guests
    guest_email  TEXT,    -- Null for logged-in users
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    sender_role     TEXT    NOT NULL, -- 'guest', 'user', 'admin'
    content         TEXT    NOT NULL,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );
`);

// ── Migration: Add columns and indexes if missing ──────────────────
try {
  db.prepare("ALTER TABLE toys ADD COLUMN description TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE users ADD COLUMN username TEXT").run();
} catch (e) {}

try {
  db.prepare("UPDATE users SET username = name WHERE username IS NULL OR username = ''").run();
} catch (e) {}

try {
  db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username COLLATE NOCASE)").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE users ADD COLUMN must_reset_password INTEGER NOT NULL DEFAULT 0").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE users ADD COLUMN last_login_at TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE users ADD COLUMN is_disabled INTEGER NOT NULL DEFAULT 0").run();
} catch (e) {}

// ── Seed Admin & Operator Accounts ──────────────────────────────────
const seedAccounts = () => {
  // Admin
  const adminExists = db.prepare("SELECT id FROM users WHERE username = ? OR email = ?").get("admin", "admin@premium.com");
  if (!adminExists) {
    const hash = bcrypt.hashSync("admin123", 10);
    db.prepare(
      "INSERT INTO users (username, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)"
    ).run("admin", "Admin User", "admin@premium.com", hash, "admin");
    console.log("✅ Admin account seeded: admin (username) / admin123");
  }

  // Operator
  const operatorExists = db.prepare("SELECT id FROM users WHERE username = ?").get("admin1");
  if (!operatorExists) {
    const hash = bcrypt.hashSync("admin123", 10);
    db.prepare(
      "INSERT INTO users (username, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)"
    ).run("admin1", "Operator User", "operator@premium.com", hash, "operator");
    console.log("✅ Operator account seeded: admin1 (username) / admin123");
  }
};

// ── Seed Toy Data ──────────────────────────────────────────────────
const seedToys = () => {
  const count = db.prepare("SELECT COUNT(*) as c FROM toys").get();
  if (count.c > 0) return;

  const toys = [
    { name: "Lego City Police Station",  price: 89.99, category: "Building Sets",  emoji: "🏛️", badge: "Hot",  rating: 4.8, reviews: 124 },
    { name: "Giant Teddy Bear",           price: 34.99, category: "Plush",          emoji: "🧸", badge: "New",  rating: 4.9, reviews: 88  },
    { name: "RC Drift Racing Car",        price: 59.99, category: "Vehicles",       emoji: "🚗", badge: "Hot",  rating: 4.7, reviews: 210 },
    { name: "Iron Man Action Figure",     price: 24.99, category: "Action Figures", emoji: "🦾", badge: "Sale", rating: 4.6, reviews: 175 },
    { name: "1000-Piece Space Puzzle",    price: 19.99, category: "Puzzles",        emoji: "🧩", badge: "New",  rating: 4.5, reviews: 63  },
    { name: "Mystery Dragon Figure",      price: 39.99, category: "Action Figures", emoji: "🐉", badge: "New",  rating: 4.8, reviews: 47  },
    { name: "Rocket Launcher Set",        price: 44.99, category: "Vehicles",       emoji: "🚀", badge: "Hot",  rating: 4.7, reviews: 99  },
    { name: "Stuffed Unicorn Plush",      price: 22.99, category: "Plush",          emoji: "🦄", badge: null,   rating: 4.4, reviews: 58  },
    { name: "Magnetic Tile Builder",      price: 54.99, category: "Building Sets",  emoji: "🔷", badge: "Hot",  rating: 4.9, reviews: 312 },
    { name: "Wooden Animal Puzzle",       price: 14.99, category: "Puzzles",        emoji: "🦁", badge: "Sale", rating: 4.3, reviews: 41  },
    { name: "Spider-Man Deluxe Figure",   price: 29.99, category: "Action Figures", emoji: "🕷️", badge: null,   rating: 4.7, reviews: 202 },
    { name: "Monster Truck Blaster",      price: 49.99, category: "Vehicles",       emoji: "🚚", badge: "Sale", rating: 4.6, reviews: 77  },
  ];

  const insert = db.prepare(
    "INSERT INTO toys (name, price, category, emoji, badge, rating, reviews) VALUES (@name, @price, @category, @emoji, @badge, @rating, @reviews)"
  );
  const insertMany = db.transaction((rows) => rows.forEach((r) => insert.run(r)));
  insertMany(toys);
  console.log(`✅ ${toys.length} toys seeded into database`);
};

seedAccounts();
seedToys();

module.exports = db;
