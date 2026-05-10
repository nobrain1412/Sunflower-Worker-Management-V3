/**
 * Chạy tất cả file SQL trong thư mục migrations/ theo thứ tự tên file.
 * Dùng: node src/utils/migrate.js
 */
require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const db   = require('./db');

const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 5000;

async function waitForDB() {
  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      await db.query('SELECT 1');
      console.log('Database ready.');
      return;
    } catch (err) {
      console.log(`Waiting for database... (attempt ${i}/${MAX_RETRIES}): ${err.message}`);
      if (i === MAX_RETRIES) throw new Error('Database not available after max retries');
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
}

async function run() {
  await waitForDB();

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
