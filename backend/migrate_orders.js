const db = require("./db");

const users = db.prepare("SELECT id FROM users").all();

db.transaction(() => {
  for (const user of users) {
    const orders = db.prepare("SELECT id FROM orders WHERE user_id = ? ORDER BY created_at ASC").all(user.id);
    orders.forEach((order, index) => {
      db.prepare("UPDATE orders SET user_order_number = ? WHERE id = ?").run(index + 1, order.id);
    });
  }
})();

console.log("✅ Migration complete: Existing orders updated with per-user numbering.");
