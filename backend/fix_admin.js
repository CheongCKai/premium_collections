const Database = require("better-sqlite3");
const path = require("path");
const bcrypt = require("bcryptjs");
const db = new Database(path.join(__dirname, "database.sqlite"));

// Check for admin user
let admin = db.prepare("SELECT * FROM users WHERE username = 'admin' OR email = 'admin@premium.com'").get();

if (!admin) {
  console.log("Admin not found, creating...");
  const hash = bcrypt.hashSync("admin123", 10);
  db.prepare("INSERT INTO users (username, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)")
    .run("admin", "Admin User", "admin@premium.com", hash, "admin");
} else {
  console.log("Admin found:", admin.username, admin.email);
  console.log("Updating admin username and password...");
  const hash = bcrypt.hashSync("admin123", 10);
  db.prepare("UPDATE users SET username = 'admin', password_hash = ? WHERE id = ?")
    .run(hash, admin.id);
}

const users = db.prepare("SELECT id, username, email, role FROM users").all();
console.table(users);
db.close();
