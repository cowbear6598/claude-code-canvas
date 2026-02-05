// 測試用 Server 啟動/關閉工具
// 提供建立測試 Bun Server + WebSocket Server 的功能

import type { Server, ServerWebSocket } from 'bun';
import { overrideConfig, testConfig } from './testConfig.js';

// 注意：不要在頂層 import 使用 config 的模組
// 這些模組需要在 overrideConfig() 之後動態 import

export interface TestServerInstance {
  server: Server;
  baseUrl: string;
  wsUrl: string;
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
  const { startupService } = await import('../../src/services/startupService.js');
  const { canvasStore } = await import('../../src/services/canvasStore.js');
  const { registerAllHandlers } = await import('../../src/handlers/index.js');
  const { connectionManager } = await import('../../src/services/connectionManager.js');
  const { eventRouter } = await import('../../src/services/eventRouter.js');
  const { deserialize } = await import('../../src/utils/messageSerializer.js');
  const { logger } = await import('../../src/utils/logger.js');
  const { WebSocketResponseEvents } = await import('../../src/schemas/index.js');

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

  // 初始化 WebSocket Service
  socketService.initialize();
  registerAllHandlers();

  // 建立 Bun Server（使用 port 0 讓系統自動分配可用 port）
  const server = Bun.serve<{ connectionId: string }>({
    port: 0,
    hostname: '0.0.0.0',
    fetch(req, server) {
      // 檢查 CORS Origin
      const origin = req.headers.get('origin');
      if (origin && origin !== testConfig.corsOrigin) {
        return new Response('Forbidden', { status: 403 });
      }

      // 嘗試升級為 WebSocket
      const success = server.upgrade(req, {
        data: { connectionId: '' }, // 將在 open 時設置
      });
      if (success) return undefined;

      // 非 WebSocket 請求返回 404
      return new Response('Not Found', { status: 404 });
    },
    websocket: {
      open(ws: ServerWebSocket<{ connectionId: string }>) {
        // 新連線處理
        const connectionId = connectionManager.add(ws);
        ws.data = { connectionId };

        socketService.emitConnectionReady(connectionId, { socketId: connectionId });

        logger.log('Connection', 'Create', `New connection: ${connectionId}`);
      },
      message(ws: ServerWebSocket<{ connectionId: string }>, message: string | Buffer) {
        const connectionId = ws.data.connectionId;

        try {
          // 解析訊息
          const parsedMessage = deserialize(message);

          // 處理心跳 pong（舊格式）
          if (parsedMessage.type === WebSocketResponseEvents.HEARTBEAT_PONG) {
            socketService.handleHeartbeatPong(connectionId);
            return;
          }

          // 處理 ack 回應（用於心跳等需要確認的訊息）
          if (parsedMessage.type === 'ack' && parsedMessage.ackId?.startsWith('heartbeat-')) {
            socketService.handleHeartbeatPong(connectionId);
            return;
          }

          // 路由訊息到對應的處理器
          eventRouter.route(connectionId, parsedMessage).catch((error) => {
            logger.error('WebSocket', 'Error', `Failed to route message: ${error}`, error);
            socketService.emitToConnection(connectionId, 'error', {
              requestId: parsedMessage.requestId,
              success: false,
              error: error instanceof Error ? error.message : '處理訊息時發生錯誤',
              code: 'ROUTING_ERROR',
            });
          });
        } catch (error) {
          logger.error('WebSocket', 'Error', `Failed to parse message: ${error}`, error);
          socketService.emitToConnection(connectionId, 'error', {
            requestId: '',
            success: false,
            error: '無效的訊息格式',
            code: 'INVALID_MESSAGE',
          });
        }
      },
      close(ws: ServerWebSocket<{ connectionId: string }>) {
        const connectionId = ws.data.connectionId;

        // 斷線處理
        socketService.cleanupSocket(connectionId);
        canvasStore.removeSocket(connectionId);

        logger.log('Connection', 'Delete', `Connection closed: ${connectionId}`);
      },
    },
  });

  const port = server.port;
  const baseUrl = `http://localhost:${port}`;
  const wsUrl = `ws://localhost:${port}`;

  return {
    server,
    baseUrl,
    wsUrl,
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
  // 停止 Schedule Service
  const { scheduleService } = await import('../../src/services/scheduleService.js');
  scheduleService.stop();

  // 停止心跳
  const { socketService } = await import('../../src/services/socketService.js');
  socketService.stopHeartbeat();

  // 關閉 Server
  server.server.stop();
}
