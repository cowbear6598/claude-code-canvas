import express from 'express';
import { createServer } from 'http';
import { config } from './config/index.js';
import { socketService } from './services/socketService.js';
import { setupSocketHandlers } from './services/socketHandlers.js';
import { startupService } from './services/startupService.js';
import { logger } from './utils/logger.js';

const app = express();

const httpServer = createServer(app);

async function startServer(): Promise<void> {
  const result = await startupService.initialize();

  if (!result.success) {
    logger.error('Startup', 'Error', 'Failed to start server', result.error);
    process.exit(1);
  }

  socketService.initialize(httpServer);

  const io = socketService.getIO();
  io.on('connection', (socket) => {
    setupSocketHandlers(socket);
  });

  const PORT = config.port;
  httpServer.listen(PORT, () => {
    logger.log('Startup', 'Complete', `Server running on port ${PORT}`);
  });
}

startServer();

const shutdown = async (signal: string): Promise<void> => {
  logger.log('Startup', 'Complete', `${signal} received, shutting down gracefully`);

  socketService.stopHeartbeat();

  const io = socketService.getIO();
  io.close();

  httpServer.close(() => {
    logger.log('Startup', 'Complete', 'Server closed successfully');
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
