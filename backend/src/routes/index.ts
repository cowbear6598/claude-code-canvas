// Note: This application uses WebSocket-first architecture.
// All Pod operations are handled via Socket.io events.

import { Router, Request, Response } from 'express';
import { socketService } from '../services/socketService.js';

const router = Router();

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// WebSocket status endpoint
router.get('/ws-status', (req: Request, res: Response) => {
  const io = socketService.getIO();
  const connectedClients = io.sockets.sockets.size;

  res.status(200).json({
    websocket: 'active',
    connectedClients,
    timestamp: new Date().toISOString(),
  });
});

export default router;
