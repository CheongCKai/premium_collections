const Database = require("better-sqlite3");
const path = require("path");
const db = new Database(path.join(__dirname, "database.sqlite"));
const info = db.prepare("PRAGMA table_info(users)").all();
console.log("Table info:", JSON.stringify(info, null, 2));
const indexInfo = db.prepare("PRAGMA index_list(users)").all();
console.log("Index list:", JSON.stringify(indexInfo, null, 2));
for (const idx of indexInfo) {
  const idxDetails = db.prepare(`PRAGMA index_info(${idx.name})`).all();
  console.log(`Index ${idx.name} info:`, JSON.stringify(idxDetails, null, 2));
}
db.close();
