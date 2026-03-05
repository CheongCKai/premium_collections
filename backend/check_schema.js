const Database = require("better-sqlite3");
const path = require("path");
const db = new Database(path.join(__dirname, "database.sqlite"));
const info = db.prepare("PRAGMA table_info(users)").all();
console.log(JSON.stringify(info, null, 2));
db.close();
