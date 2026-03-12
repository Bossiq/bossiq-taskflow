/**
 * TaskFlow API — Express application factory.
 *
 * Exports the configured Express app for both the server and tests.
 * Security: Helmet, rate limiting, compression, XSS sanitization.
 *
 * @module server/app
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { randomUUID } from 'crypto';
import taskRoutes from './routes/tasks.js';
import projectRoutes from './routes/projects.js';
import subtaskRoutes from './routes/subtasks.js';
import activityRoutes from './routes/activity.js';
import authRoutes from './routes/auth.js';
import commentRoutes from './routes/comments.js';
import { optionalAuth } from './middleware/auth.js';
import { sanitizeBody } from './middleware/sanitize.js';

const app = express();
const IS_PROD = process.env.NODE_ENV === 'production';

// ── Security Headers ──
app.use(helmet({
  contentSecurityPolicy: IS_PROD ? undefined : false,
  crossOriginEmbedderPolicy: false
}));

// ── Compression ──
app.use(compression());

// ── CORS ──
app.use(cors({
  origin: IS_PROD ? process.env.ALLOWED_ORIGIN : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ── Body parsing with size limit ──
app.use(express.json({ limit: '100kb' }));

// ── XSS sanitization ──
app.use(sanitizeBody);

// ── Rate limiting ──
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_PROD ? 100 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', apiLimiter);

// ── Request ID + Logging ──
app.use((req, res, next) => {
  req.id = randomUUID().slice(0, 8);
  res.setHeader('X-Request-Id', req.id);
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const status = res.statusCode;
    const color = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : '\x1b[32m';
    if (process.env.NODE_ENV !== 'test') {
      console.log(`${color}${req.method}\x1b[0m ${req.originalUrl} → ${status} (${ms}ms) [${req.id}]`);
    }
  });
  next();
});

// ── API Routes ──
app.use('/api/auth', authRoutes);
app.use('/api/tasks', optionalAuth, taskRoutes);
app.use('/api/tasks/:taskId/subtasks', optionalAuth, subtaskRoutes);
app.use('/api/tasks/:taskId/comments', optionalAuth, commentRoutes);
app.use('/api/projects', optionalAuth, projectRoutes);
app.use('/api/activity', optionalAuth, activityRoutes);

/** @route GET /api/health — Health check endpoint */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// ── 404 for unknown API routes ──
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
});

// ── Global error handler ──
app.use((err, req, res, _next) => {
  if (process.env.NODE_ENV !== 'test') {
    console.error(`\x1b[31m[ERROR]\x1b[0m [${req.id}]`, err.stack || err.message);
  }
  res.status(err.status || 500).json({
    error: IS_PROD ? 'Internal server error' : err.message
  });
});

export default app;
