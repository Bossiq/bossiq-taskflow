/**
 * TaskFlow API — Server entry point with Socket.IO.
 *
 * Exports the configured HTTP server with WebSocket support.
 * Broadcasts task/project changes to connected clients.
 *
 * @module server
 */

import { createServer } from 'http';
import { Server } from 'socket.io';
import app from './app.js';

const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === 'production';

const httpServer = createServer(app);

// ── Socket.IO ──
const io = new Server(httpServer, {
  cors: {
    origin: IS_PROD
      ? [process.env.ALLOWED_ORIGIN || 'https://bossiq-taskflow.vercel.app', 'http://localhost:5173']
      : 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Make io accessible from Express routes via app.locals
app.set('io', io);

io.on('connection', (socket) => {
  console.log(`\x1b[35m⚡ WS client connected\x1b[0m [${socket.id}]`);

  socket.on('disconnect', () => {
    console.log(`\x1b[90m⚡ WS client disconnected\x1b[0m [${socket.id}]`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`\x1b[36m⚡ TaskFlow API running on http://localhost:${PORT}\x1b[0m`);
  console.log(`   Environment: ${IS_PROD ? 'production' : 'development'}`);
  console.log(`   WebSocket: enabled`);
});

// ── Graceful shutdown ──
const shutdown = (signal) => {
  console.log(`\n\x1b[33m${signal} received. Shutting down gracefully...\x1b[0m`);
  io.close();
  httpServer.close(() => {
    console.log('\x1b[32mServer closed.\x1b[0m');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
