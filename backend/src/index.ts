import type { ServerWebSocket } from 'bun';
import { config } from './config/index.js';
import { socketService } from './services/socketService.js';
import { canvasStore } from './services/canvasStore.js';
import { startupService } from './services/startupService.js';
import { registerAllHandlers } from './handlers/index.js';
import { connectionManager } from './services/connectionManager.js';
import { eventRouter } from './services/eventRouter.js';
import { deserialize } from './utils/messageSerializer.js';
import { logger } from './utils/logger.js';
import { WebSocketResponseEvents } from './schemas/index.js';
import { isStaticFilesAvailable, serveStaticFile } from './utils/staticFileServer.js';

async function startServer(): Promise<void> {
	const result = await startupService.initialize();

	if (!result.success) {
		logger.error('Startup', 'Error', 'Failed to start server', result.error);
		process.exit(1);
	}

	socketService.initialize();
	registerAllHandlers();

	const PORT = config.port;

	// 只在 production 模式且 dist 目錄存在時才啟用靜態檔案服務，dev 模式由 Vite dev server 提供
	const enableStaticFiles = config.nodeEnv === 'production' && (await isStaticFilesAvailable());
	if (enableStaticFiles) {
		logger.log('Startup', 'Complete', '已啟用前端靜態檔案服務');
	}

	Bun.serve<{ connectionId: string }>({
		port: PORT,
		hostname: '0.0.0.0',
		fetch(req, server) {
			// 檢查 CORS Origin
			const origin = req.headers.get('origin');
			if (origin && !config.corsOrigin(origin)) {
				return new Response('Forbidden', { status: 403 });
			}

			// 檢查是否為 WebSocket upgrade 請求
			const upgradeHeader = req.headers.get('upgrade');
			if (upgradeHeader?.toLowerCase() === 'websocket') {
				// 嘗試升級為 WebSocket
				const success = server.upgrade(req, {
					data: { connectionId: '' }, // 將在 open 時設置
				});
				if (success) return undefined;
			}

			// 普通 HTTP 請求：serve 靜態檔案（如果已啟用）
			if (enableStaticFiles) {
				return serveStaticFile(req);
			}

			// 未啟用靜態檔案服務時返回 404
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

	logger.log('Startup', 'Complete', `Server running on port ${PORT}`);
}

startServer();

const shutdown = async (signal: string): Promise<void> => {
	logger.log('Startup', 'Complete', `${signal} received, shutting down gracefully`);

	socketService.stopHeartbeat();

	logger.log('Startup', 'Complete', 'Server closed successfully');
	process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
