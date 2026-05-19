/**
 * Chạy backup DB thủ công (không qua migrate).
 *
 * Dùng khi:
 *   - Sắp làm thao tác nguy hiểm (truncate, sửa dữ liệu hàng loạt)
 *   - Trước khi restore từ backup khác
 *   - Lỡ deploy bị fail trước khi backup kịp chạy
 *
 * Cách chạy:
 *   Local:           DATABASE_URL=... node src/utils/backup-now.js [reason]
 *   Railway shell:   npm run backup --prefix backend -- [reason]
 *   Railway one-off: thêm command "npm run backup" trong deploy
 *
 * Reason mặc định = "manual". Ví dụ: npm run backup manual-truoc-khi-sua-pass
 */
require('dotenv').config();
const { runBackup, pruneOldBackups } = require('./backup');

const reason = (process.argv[2] || 'manual').replace(/[^a-zA-Z0-9-_]/g, '_');

runBackup({ reason })
  .then((filepath) => {
    if (!filepath) {
      console.error('✗ Backup không tạo được file (xem warning bên trên).');
      process.exit(1);
    }
    pruneOldBackups();
    process.exit(0);
  })
  .catch((err) => {
    console.error(`✗ Backup thất bại: ${err.message}`);
    process.exit(1);
  });
