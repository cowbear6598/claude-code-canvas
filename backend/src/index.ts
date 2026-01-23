// Server Entry Point
// Main application initialization and startup
// WebSocket-first Architecture - All Pod operations via Socket.io

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { config } from './config/index.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import apiRoutes from './routes/index.js';
import { socketService } from './services/socketService.js';
import { setupSocketHandlers } from './services/socketHandlers.js';
import { startupService } from './services/startupService.js';

const app = express();

// Apply middleware
app.use(helmet()); // Security headers
app.use(cors({ origin: config.corsOrigin })); // CORS configuration
app.use(express.json()); // Parse JSON bodies (for health check endpoint)
app.use(requestLogger); // Request logging

// Mount API routes (health check only)
app.use('/api', apiRoutes);

// Apply error handler middleware (must be last)
app.use(errorHandler);

// Create HTTP server
const httpServer = createServer(app);

// Initialize startup service (load data from disk)
async function startServer() {
  try {
    // Initialize data (load Pods and chat history)
    await startupService.initialize();

    // Initialize Socket.io service
    socketService.initialize(httpServer);

    // Setup Socket.io connection handlers
    const io = socketService.getIO();
    io.on('connection', (socket) => {
      setupSocketHandlers(socket);
    });

    // Start server
    const PORT = config.port;
    httpServer.listen(PORT, () => {
      console.log(`[Server] 🚀 Running on port ${PORT}`);
      console.log(`[Server] 📡 WebSocket-first architecture enabled`);
      console.log(`[Server] Environment: ${config.nodeEnv}`);
      console.log(`[Server] CORS Origin: ${config.corsOrigin}`);
      console.log(`[Server] Workspace Root: ${config.workspaceRoot}`);
      console.log(`[Server] Authentication: Claude Code CLI`);
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

// Graceful shutdown handlers
const shutdown = async (signal: string) => {
  console.log(`[Server] ${signal} received, shutting down gracefully...`);

  // Get Socket.io instance
  const io = socketService.getIO();

  // Close Socket.io server
  io.close(() => {
    console.log('[Socket.io] Server closed');
  });

  // Close HTTP server
  httpServer.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
