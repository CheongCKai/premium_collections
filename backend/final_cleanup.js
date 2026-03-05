const Database = require("better-sqlite3");
const path = require("path");
const db = new Database(path.join(__dirname, "database.sqlite"));
// Wipe everyone except the main admin if necessary, or just fix specific issues
db.prepare("DELETE FROM users WHERE id > 1").run();
// Fix id 1 username if empty
db.prepare("UPDATE users SET username = 'admin' WHERE id = 1 AND (username IS NULL OR username = '')").run();
db.close();
console.log("Cleanup final complete.");
