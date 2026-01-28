// 測試用 Server 啟動/關閉工具
// 提供建立測試 HTTP Server + Socket.io Server 的功能

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer, Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { AddressInfo } from 'net';
import { overrideConfig, testConfig } from './testConfig.js';
import { socketService } from '../../src/services/socketService.js';
import { setupSocketHandlers } from '../../src/services/socketHandlers.js';
import { startupService } from '../../src/services/startupService.js';
import apiRoutes from '../../src/routes/index.js';
import { requestLogger } from '../../src/middleware/requestLogger.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';

export interface TestServerInstance {
  httpServer: HttpServer;
  io: SocketIOServer;
  app: express.Application;
  baseUrl: string;
  port: number;
}

/**
 * 建立測試用 Server
 * 使用動態 Port 避免衝突
 * 初始化 startupService 以載入資料
 */
export async function createTestServer(): Promise<TestServerInstance> {
  // 覆寫設定為測試環境
  await overrideConfig();

  const app = express();

  app.use(helmet());
  app.use(cors({ origin: testConfig.corsOrigin }));
  app.use(express.json());
  app.use(requestLogger);

  app.use('/api', apiRoutes);

  app.use(errorHandler);

  const httpServer = createServer(app);

  // 初始化資料
  const result = await startupService.initialize();
  if (!result.success) {
    throw new Error(`Failed to initialize test server: ${result.error}`);
  }

  // 初始化 Socket.io
  socketService.initialize(httpServer);

  const io = socketService.getIO();
  io.on('connection', (socket) => {
    setupSocketHandlers(socket);
  });

  // 使用 port 0 讓系統自動分配可用 port
  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      resolve();
    });
  });

  const address = httpServer.address() as AddressInfo;
  const port = address.port;
  const baseUrl = `http://localhost:${port}`;

  return {
    httpServer,
    io,
    app,
    baseUrl,
    port,
  };
}

/**
 * 關閉測試 Server
 * 處理優雅關閉
 */
export async function closeTestServer(server: TestServerInstance): Promise<void> {
  const { httpServer, io } = server;

  // 關閉 Socket.io
  io.close();

  // 關閉 HTTP Server
  await new Promise<void>((resolve, reject) => {
    httpServer.close((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}
