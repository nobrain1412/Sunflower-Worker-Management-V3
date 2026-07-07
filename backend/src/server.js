require('dotenv').config();

const app    = require('./app');
const logger = require('./utils/logger');
const db     = require('./utils/db');

const PORT = parseInt(process.env.PORT || '3000', 10);

async function start() {
  // Kiểm tra kết nối DB trước khi mở server
  try {
    await db.query('SELECT 1');
    logger.info('Database connected');
  } catch (err) {
    logger.fatal({ err }, 'Cannot connect to database — exiting');
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    logger.info(`WorkerOS API running on port ${PORT} [${process.env.NODE_ENV}]`);
  });

  // Reverse proxy của Railway giữ keep-alive ~60s. Nếu Node đóng connection sớm hơn
  // proxy, proxy sẽ dùng lại connection đã chết → thỉnh thoảng trả 502. Đặt keepAlive
  // dài hơn proxy và headersTimeout > keepAliveTimeout để tránh race đóng sớm.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 70_000;
}

start();
