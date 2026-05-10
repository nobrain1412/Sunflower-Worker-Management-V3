const pino = require('pino');

const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
    : undefined,
  redact: {
    // Không log thông tin nhạy cảm
    paths: ['*.cccd', '*.so_dien_thoai', '*.password', 'req.headers.authorization'],
    censor: '[REDACTED]',
  },
});

module.exports = logger;
