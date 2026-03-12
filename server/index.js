/**
 * TaskFlow API — Server entry point.
 * Imports the app and starts listening.
 *
 * @module server
 */

import app from './app.js';

const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === 'production';

const server = app.listen(PORT, () => {
  console.log(`\x1b[36m⚡ TaskFlow API running on http://localhost:${PORT}\x1b[0m`);
  console.log(`   Environment: ${IS_PROD ? 'production' : 'development'}`);
});

// ── Graceful shutdown ──
const shutdown = (signal) => {
  console.log(`\n\x1b[33m${signal} received. Shutting down gracefully...\x1b[0m`);
  server.close(() => {
    console.log('\x1b[32mServer closed.\x1b[0m');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
