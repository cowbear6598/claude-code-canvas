// 測試用 Server 啟動/關閉工具
// 提供建立測試 HTTP Server + Socket.io Server 的功能

import express from 'express';
import cors from 'cors';
import { createServer, Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { AddressInfo } from 'net';
import { overrideConfig, testConfig } from './testConfig.js';

// 注意：不要在頂層 import 使用 config 的模組
// 這些模組需要在 overrideConfig() 之後動態 import

export interface TestServerInstance {
  httpServer: HttpServer;
  io: SocketIOServer;
  app: express.Application;
  baseUrl: string;
  port: number;
  canvasId: string;
  canvasDataDir: string;
}

/**
 * 建立測試用 Server
 * 使用動態 Port 避免衝突
 * 初始化 startupService 以載入資料
 */
export async function createTestServer(): Promise<TestServerInstance> {
  // 必須先覆寫設定，再 import 使用 config 的模組
  await overrideConfig();

  // 動態 import 使用 config 的模組（確保使用測試配置）
  const { socketService } = await import('../../src/services/socketService.js');
  const { setupSocketHandlers } = await import('../../src/services/socketHandlers.js');
  const { startupService } = await import('../../src/services/startupService.js');
  const { canvasStore } = await import('../../src/services/canvasStore.js');

  const app = express();

  app.use(cors({ origin: testConfig.corsOrigin }));
  app.use(express.json());

  const httpServer = createServer(app);

  // 初始化資料
  const result = await startupService.initialize();
  if (!result.success) {
    throw new Error(`Failed to initialize test server: ${result.error}`);
  }

  const canvases = canvasStore.list();
  const defaultCanvas = canvases[0];
  const canvasDataDir = canvasStore.getCanvasDataDir(defaultCanvas.id);

  if (!canvasDataDir) {
    throw new Error('Failed to get canvas data directory');
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
    canvasId: defaultCanvas.id,
    canvasDataDir,
  };
}

/**
 * 關閉測試 Server
 * 處理優雅關閉
 */
export async function closeTestServer(server: TestServerInstance): Promise<void> {
  const { httpServer, io } = server;

  // 停止 Schedule Service
  const { scheduleService } = await import('../../src/services/scheduleService.js');
  scheduleService.stop();

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
