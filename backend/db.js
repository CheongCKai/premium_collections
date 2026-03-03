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
    name         TEXT    NOT NULL,
    email        TEXT    NOT NULL UNIQUE,
    password_hash TEXT   NOT NULL,
    role         TEXT    NOT NULL DEFAULT 'user',
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS toys (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    name     TEXT    NOT NULL,
    price    REAL    NOT NULL,
    category TEXT    NOT NULL,
    emoji    TEXT    NOT NULL,
    badge    TEXT,
    rating   REAL    NOT NULL DEFAULT 0,
    reviews  INTEGER NOT NULL DEFAULT 0
  );
`);

// ── Seed Admin Account ─────────────────────────────────────────────
const seedAdmin = () => {
  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get("admin@premium.com");
  if (!exists) {
    const hash = bcrypt.hashSync("admin123", 10);
    db.prepare(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)"
    ).run("Admin", "admin@premium.com", hash, "admin");
    console.log("✅ Admin account seeded: admin@premium.com / admin123");
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

seedAdmin();
seedToys();

module.exports = db;
