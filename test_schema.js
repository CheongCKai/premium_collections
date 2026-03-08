const db = require('./backend/db');
console.log(db.prepare("PRAGMA table_info('users')").all());
