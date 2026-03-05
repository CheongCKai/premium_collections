const Database = require("better-sqlite3");
const path = require("path");
const db = new Database(path.join(__dirname, "database.sqlite"));
const users = db.prepare("SELECT id, username, email, role, password_hash FROM users").all();
console.log("Current Users:", JSON.stringify(users, null, 2));
db.close();
