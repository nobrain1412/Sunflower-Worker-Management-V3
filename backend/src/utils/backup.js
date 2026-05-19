/**
 * Backup DB bằng pg_dump, lưu file .sql.gz vào Railway Volume.
 * Gọi từ migrate.js TRƯỚC khi áp migration → an toàn cho dữ liệu prod.
 *
 * ENV cần:
 *   DATABASE_URL  — chuỗi kết nối Postgres (Railway tự inject)
 *   BACKUP_DIR    — thư mục lưu backup (default: /data/backups)
 *   BACKUP_KEEP   — số bản giữ lại (default: 20)
 *
 * Trên Railway:
 *   Mount Volume vào /data ở backend service. Nếu chưa mount, code tự skip
 *   và in cảnh báo, KHÔNG block deploy.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const BACKUP_DIR = process.env.BACKUP_DIR || '/data/backups';
const KEEP = parseInt(process.env.BACKUP_KEEP || '20', 10);

function ensureDir() {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    return true;
  } catch (err) {
    console.warn(`⚠ Không tạo được thư mục backup ${BACKUP_DIR}: ${err.message}`);
    console.warn('  → Bỏ qua backup. Mount Railway Volume vào /data để bật.');
    return false;
  }
}

function formatTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-`
       + `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

/**
 * Chạy pg_dump | gzip → file. Resolve về đường dẫn file backup, hoặc null nếu skip.
 */
function runBackup({ reason = 'migrate' } = {}) {
  if (!process.env.DATABASE_URL) {
    console.warn('⚠ DATABASE_URL không có → bỏ qua backup');
    return Promise.resolve(null);
  }
  if (!ensureDir()) return Promise.resolve(null);

  const filename = `dump-${formatTimestamp()}-${reason}.sql.gz`;
  const filepath = path.join(BACKUP_DIR, filename);
  console.log(`📦 Backup DB → ${filepath}`);

  return new Promise((resolve, reject) => {
    // pg_dump $DATABASE_URL --no-owner --no-acl | gzip > file
    const dump = spawn('pg_dump', [
      process.env.DATABASE_URL,
      '--no-owner',
      '--no-acl',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    const gzip = spawn('gzip', ['-c'], { stdio: ['pipe', 'pipe', 'inherit'] });
    const out = fs.createWriteStream(filepath);

    let dumpStderr = '';
    dump.stderr.on('data', (b) => { dumpStderr += b.toString(); });

    dump.stdout.pipe(gzip.stdin);
    gzip.stdout.pipe(out);

    let dumpCode = null;
    let gzipCode = null;
    let outClosed = false;

    const tryFinish = () => {
      if (dumpCode === null || gzipCode === null || !outClosed) return;
      if (dumpCode !== 0) {
        try { fs.unlinkSync(filepath); } catch {}
        return reject(new Error(`pg_dump exit ${dumpCode}: ${dumpStderr.trim()}`));
      }
      if (gzipCode !== 0) {
        try { fs.unlinkSync(filepath); } catch {}
        return reject(new Error(`gzip exit ${gzipCode}`));
      }
      const size = fs.statSync(filepath).size;
      console.log(`✓ Backup xong: ${filename} (${(size / 1024).toFixed(1)} KB)`);
      resolve(filepath);
    };

    dump.on('exit', (code) => { dumpCode = code; tryFinish(); });
    gzip.on('exit', (code) => { gzipCode = code; tryFinish(); });
    out.on('close', () => { outClosed = true; tryFinish(); });
    out.on('error', reject);
  });
}

/**
 * Xoá bản backup cũ hơn KEEP gần nhất.
 */
function pruneOldBackups() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return;
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('dump-') && f.endsWith('.sql.gz'))
      .map((f) => ({
        name: f,
        mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    const toDelete = files.slice(KEEP);
    for (const f of toDelete) {
      fs.unlinkSync(path.join(BACKUP_DIR, f.name));
      console.log(`  ↷ xoá backup cũ: ${f.name}`);
    }
    if (files.length > 0) {
      console.log(`  Giữ ${Math.min(files.length, KEEP)} bản backup gần nhất tại ${BACKUP_DIR}`);
    }
  } catch (err) {
    console.warn(`⚠ Lỗi prune backup: ${err.message}`);
  }
}

module.exports = { runBackup, pruneOldBackups, BACKUP_DIR, KEEP };
