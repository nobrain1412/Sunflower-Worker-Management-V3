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

module.exports = pool;
