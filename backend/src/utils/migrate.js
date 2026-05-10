/**
 * Chạy tất cả file SQL trong thư mục migrations/ theo thứ tự tên file.
 * Dùng: node src/utils/migrate.js
 */
require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const db   = require('./db');

async function run() {
  const dir = path.join(__dirname, '../../migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    console.log(`Running migration: ${file}`);
    await db.query(sql);
    console.log(`  ✓ ${file}`);
  }

  await db.end();
  console.log('Migrations complete.');
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
