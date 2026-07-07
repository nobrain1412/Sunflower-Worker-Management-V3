const { Pool } = require('pg');
const logger = require('./logger');

const isProduction = process.env.NODE_ENV === 'production';

// Railway cung cấp DATABASE_URL hoặc PG* vars, fallback về DB_* vars cho local dev
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      // Bật TCP keepalive để NAT/proxy không đóng connection idle âm thầm sau đêm
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    }
  : {
      host:     process.env.PGHOST     || process.env.DB_HOST,
      port:     parseInt(process.env.PGPORT     || process.env.DB_PORT     || '5432'),
      database: process.env.PGDATABASE || process.env.DB_NAME,
      user:     process.env.PGUSER     || process.env.DB_USER,
      password: process.env.PGPASSWORD || process.env.DB_PASSWORD,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    };

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle DB client');
});

/**
 * Chạy fn trong 1 transaction trên MỘT client riêng lấy từ pool.
 *   BEGIN → fn(client) → COMMIT; nếu lỗi → ROLLBACK. Luôn release client.
 *
 * QUAN TRỌNG: dùng thay cho pattern `db.query('BEGIN')` trực tiếp trên pool.
 * Pool có thể trả mỗi câu lệnh trên connection khác nhau → BEGIN/COMMIT lạc
 * connection, transaction sai và "bỏ quên" connection còn dở transaction về pool
 * → nghẽn pool khi tải cao. fn phải dùng `client.query`, KHÔNG dùng `db.query`.
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      logger.error({ err: rollbackErr }, 'ROLLBACK thất bại');
    }
    throw err;
  } finally {
    client.release();
  }
}

pool.withTransaction = withTransaction;

module.exports = pool;
