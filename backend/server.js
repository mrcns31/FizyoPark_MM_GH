import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Routes
import authRoutes from './routes/auth.js';
import sessionsRoutes from './routes/sessions.js';
import staffRoutes from './routes/staff.js';
import membersRoutes from './routes/members.js';
import roomsRoutes from './routes/rooms.js';
import settingsRoutes from './routes/settings.js';
import packagesRoutes from './routes/packages.js';
import memberPackagesRoutes from './routes/member-packages.js';
import activityLogsRoutes from './routes/activity-logs.js';
import devResetRoutes from './routes/dev-reset.js';
import memberPortalRoutes from './routes/member-portal.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet()); // Güvenlik başlıkları
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(morgan('combined')); // Loglama
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate Limiting: localhost ve development'ta devre dışı (randevu silme vb. engellenmesin)
const isLocalhost = (req) => {
  const ip = (req.ip || req.connection?.remoteAddress || '').toString();
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip.includes('127.0.0.1');
};
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 2000,
  message: 'Çok fazla istek gönderildi, lütfen daha sonra tekrar deneyin.',
  skip: (req) =>
    process.env.RATE_LIMIT_DISABLED === '1' ||
    process.env.NODE_ENV === 'development' ||
    isLocalhost(req)
});
app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/members', membersRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/packages', packagesRoutes);
app.use('/api/member-packages', memberPackagesRoutes);
app.use('/api/activity-logs', activityLogsRoutes);
app.use('/api/dev-reset', devResetRoutes);
app.use('/api/member-portal', memberPortalRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Bir hata oluştu' 
      : err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint bulunamadı' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server çalışıyor: http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});
