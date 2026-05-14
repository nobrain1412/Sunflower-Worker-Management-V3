require('dotenv').config();

const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const compression  = require('compression');
const rateLimit    = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const path         = require('path');
const errorHandler = require('./middleware/errorHandler');
const logger       = require('./utils/logger');

const authRoutes      = require('./routes/auth');
const congNhanRoutes  = require('./routes/congNhan');
const congTyRoutes    = require('./routes/congTy');
const dashboardRoutes = require('./routes/dashboard');
const usersRoutes     = require('./routes/users');
const ktxRoutes       = require('./routes/ktx');
const phongTroRoutes  = require('./routes/phongTro');
const taiChinhRoutes  = require('./routes/taiChinh');
const ocrRoutes       = require('./routes/ocr');

const app = express();

// Trust Railway / reverse proxy — cần thiết để express-rate-limit đọc đúng IP
app.set('trust proxy', 1);

// --- Security ---
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// --- Rate limit: 100 req/phút/IP ---
app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Quá nhiều yêu cầu, thử lại sau' } },
}));

// --- Static files (ảnh upload) ---
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// --- Parser ---
app.use(express.json({ limit: '2mb', strict: false }));
app.use(cookieParser());
app.use(compression());

// --- Request logging ---
app.use((req, _res, next) => {
  logger.debug({ method: req.method, url: req.originalUrl }, 'Incoming request');
  next();
});

// --- Routes ---
app.use('/api/auth',      authRoutes);
app.use('/api/cong-nhan', congNhanRoutes);
app.use('/api/cong-ty',   congTyRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users',     usersRoutes);
app.use('/api/ktx',       ktxRoutes);
app.use('/api/phong-tro', phongTroRoutes);
app.use('/api/tai-chinh', taiChinhRoutes);
app.use('/api/ocr',       ocrRoutes);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// API 404 — phải đặt trước catch-all của React
app.use('/api', (_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Endpoint không tồn tại' } });
});

// Serve frontend React app trong production (Railway)
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));
  // Mọi route không phải /api đều trả về index.html để React Router xử lý
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Error handler (phải là middleware cuối cùng, 4 tham số)
app.use(errorHandler);

module.exports = app;
