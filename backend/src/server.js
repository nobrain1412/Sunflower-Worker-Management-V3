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

  app.listen(PORT, () => {
    logger.info(`WorkerOS API running on port ${PORT} [${process.env.NODE_ENV}]`);
  });
}

start();
