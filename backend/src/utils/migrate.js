/**
 * Chạy tất cả file SQL trong thư mục migrations/ theo thứ tự tên file.
 * Mỗi file chỉ chạy 1 lần — được track trong bảng `schema_migrations`.
 *
 * Bootstrap: nếu DB đã có `users` table nhưng chưa có `schema_migrations`
 * (legacy state), mark tất cả file hiện có là "applied" để TRÁNH chạy lại
 * `DROP SCHEMA` trong 001_init_schema.sql và xóa mất dữ liệu prod.
 *
 * Dùng: node src/utils/migrate.js
 */
require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const db   = require('./db');
const { runBackup, pruneOldBackups } = require('./backup');

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

async function ensureMigrationsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function bootstrapIfNeeded(files) {
  const { rows: tracked } = await db.query('SELECT 1 FROM schema_migrations LIMIT 1');
  if (tracked.length > 0) return; // Đã có tracking → bỏ qua bootstrap.

  // Nếu DB có sẵn `users` table → schema đã được apply lần đầu trước khi có
  // tracking. Bootstrap bằng cách mark TẤT CẢ file hiện tại là đã applied
  // để tránh chạy lại DROP SCHEMA và xóa dữ liệu.
  const { rows: usersExists } = await db.query(`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  `);
  if (usersExists.length === 0) return; // DB rỗng → cứ chạy migrations bình thường.

  console.log('⚠ Bootstrap: phát hiện DB có dữ liệu nhưng chưa tracking migration.');
  console.log('  → Mark tất cả file hiện tại là APPLIED để bảo vệ dữ liệu prod.');
  for (const f of files) {
    await db.query(
      'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
      [f],
    );
    console.log(`  ↷ marked ${f}`);
  }
}

async function run() {
  await waitForDB();
  await ensureMigrationsTable();

  const dir = path.join(__dirname, '../../migrations');
  const files = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  await bootstrapIfNeeded(files);

  // Xác định migration nào còn pending (chỉ để log)
  const pending = [];
  for (const file of files) {
    const { rows } = await db.query(
      'SELECT 1 FROM schema_migrations WHERE filename = $1',
      [file],
    );
    if (rows.length === 0) pending.push(file);
  }
  if (pending.length > 0) {
    console.log(`Có ${pending.length} migration pending: ${pending.join(', ')}`);
  }

  // SKIP_BACKUP=true → bỏ qua backup hoàn toàn. Dùng khi chạy migration TỪ MÁY LOCAL
  // (không cài pg_dump) trỏ vào DB Railway — DB đã được Railway backup sẵn, migration
  // chỉ THÊM (không xoá) nên an toàn. KHÔNG set biến này trên Railway production.
  if (process.env.SKIP_BACKUP === 'true') {
    console.log('⏭  SKIP_BACKUP=true → bỏ qua backup trước migration (chế độ chạy local).');
  } else {
    // Backup TRƯỚC mỗi lần deploy (mỗi lần migrate.js chạy = mỗi lần Railway start).
    // Nếu có migration pending → backup là pre-migrate, đặc biệt quan trọng.
    // Nếu không có pending → vẫn backup vì code mới có thể chứa bug làm hỏng data.
    // Nếu backup fail VÀ có migration pending → ABORT để bảo vệ dữ liệu.
    // Nếu backup fail nhưng không có migration → chỉ warning, vẫn cho start (vì không sửa schema).
    try {
      const reason = pending.length > 0 ? 'pre-migrate' : 'deploy';
      const backupPath = await runBackup({ reason });
      if (!backupPath && process.env.REQUIRE_BACKUP === 'true') {
        throw new Error('REQUIRE_BACKUP=true nhưng backup bị skip (volume chưa mount?)');
      }
      if (backupPath) pruneOldBackups();
    } catch (err) {
      if (pending.length > 0) {
        console.error(`✗ Backup thất bại trước migration: ${err.message}`);
        console.error('  → Hủy migration để bảo vệ dữ liệu. Sửa lỗi backup rồi deploy lại.');
        console.error('  → Nếu chạy local không có pg_dump: set SKIP_BACKUP=true để bỏ qua backup.');
        throw err;
      }
      console.warn(`⚠ Backup thất bại: ${err.message}`);
      console.warn('  → Không có migration pending nên vẫn tiếp tục start. Hãy fix backup sớm.');
    }
  }

  for (const file of files) {
    const { rows: applied } = await db.query(
      'SELECT 1 FROM schema_migrations WHERE filename = $1',
      [file],
    );
    if (applied.length > 0) {
      console.log(`  ↷ skip ${file} (already applied)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    console.log(`Running migration: ${file}`);
    await db.query(sql);
    await db.query(
      'INSERT INTO schema_migrations (filename) VALUES ($1)',
      [file],
    );
    console.log(`  ✓ ${file}`);
  }

  await db.end();
  console.log('Migrations complete.');
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
