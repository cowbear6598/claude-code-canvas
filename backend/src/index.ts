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

app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());
app.use(requestLogger);

app.use('/api', apiRoutes);

app.use(errorHandler);

const httpServer = createServer(app);

async function startServer(): Promise<void> {
  const result = await startupService.initialize();

  if (!result.success) {
    console.error('[Server] Failed to start:', result.error);
    process.exit(1);
  }

  socketService.initialize(httpServer);

  const io = socketService.getIO();
  io.on('connection', (socket) => {
    setupSocketHandlers(socket);
  });

  const PORT = config.port;
  httpServer.listen(PORT, () => {
    console.log(`[Server] 🚀 Running on port ${PORT}`);
    console.log(`[Server] 📡 WebSocket-first architecture enabled`);
    console.log(`[Server] Environment: ${config.nodeEnv}`);
    console.log(`[Server] CORS Origin: ${config.corsOrigin}`);
    console.log(`[Server] App Data Root: ${config.appDataRoot}`);
    console.log(`[Server] Canvas Root: ${config.canvasRoot}`);
    console.log(`[Server] Repositories Root: ${config.repositoriesRoot}`);
    console.log(`[Server] Authentication: Claude Code CLI`);
  });
}

startServer();

const shutdown = async (signal: string): Promise<void> => {
  console.log(`[Server] ${signal} received, shutting down gracefully...`);

  const io = socketService.getIO();

  io.close(() => {
    console.log('[Socket.io] Server closed');
  });

  httpServer.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
