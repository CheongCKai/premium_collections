const Database = require("better-sqlite3");
const path = require("path");
const db = new Database(path.join(__dirname, "database.sqlite"));
// Delete the duplicate/invalid admin account
db.prepare("DELETE FROM users WHERE id = 2").run();
// Ensure all users have a username
db.prepare("UPDATE users SET username = name WHERE username IS NULL").run();
db.close();
console.log("Cleanup complete.");
