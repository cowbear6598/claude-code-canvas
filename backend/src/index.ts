import type { ServerWebSocket } from 'bun';
import { config } from './config/index.js';
import { socketService } from './services/socketService.js';
import { canvasStore } from './services/canvasStore.js';
import { startupService } from './services/startupService.js';
import { registerAllHandlers } from './handlers/index.js';
import { connectionManager } from './services/connectionManager.js';
import { eventRouter } from './services/eventRouter.js';
import { broadcastCursorLeft } from './handlers/cursorHandlers.js';
import { deserialize } from './utils/messageSerializer.js';
import { logger } from './utils/logger.js';
import { WebSocketResponseEvents } from './schemas/index.js';
import { isStaticFilesAvailable, serveStaticFile } from './utils/staticFileServer.js';
import { handleApiRequest } from './api/apiRouter.js';

async function startServer(): Promise<void> {
	const result = await startupService.initialize();

	if (!result.success) {
		logger.error('Startup', 'Error', 'Failed to start server', result.error);
		process.exit(1);
	}

	socketService.initialize();
	registerAllHandlers();

	const PORT = config.port;

	const enableStaticFiles = config.nodeEnv === 'production' && (await isStaticFilesAvailable());
	if (enableStaticFiles) {
		logger.log('Startup', 'Complete', '已啟用前端靜態檔案服務');
	}

	Bun.serve<{ connectionId: string }>({
		port: PORT,
		hostname: '0.0.0.0',
		async fetch(req, server) {
			const origin = req.headers.get('origin');
			if (origin && !config.corsOrigin(origin)) {
				return new Response('Forbidden', { status: 403 });
			}

			const apiResponse = await handleApiRequest(req);
			if (apiResponse !== null) {
				return apiResponse;
			}

			const upgradeHeader = req.headers.get('upgrade');
			if (upgradeHeader?.toLowerCase() === 'websocket') {
				const success = server.upgrade(req, {
					data: { connectionId: '' }, // 將在 open 時設置
				});
				if (success) return undefined;
			}

			if (enableStaticFiles) {
				return serveStaticFile(req);
			}

			return new Response('Not Found', { status: 404 });
		},
		websocket: {
			open(webSocket: ServerWebSocket<{ connectionId: string }>) {
				const connectionId = connectionManager.add(webSocket);
				webSocket.data = { connectionId };

				socketService.emitConnectionReady(connectionId, { socketId: connectionId });

				logger.log('Connection', 'Create', `New connection: ${connectionId}`);
			},
			message(webSocket: ServerWebSocket<{ connectionId: string }>, message: string | Buffer) {
				const connectionId = webSocket.data.connectionId;

				try {
					const parsedMessage = deserialize(message);

					if (parsedMessage.type === WebSocketResponseEvents.HEARTBEAT_PONG) {
						socketService.handleHeartbeatPong(connectionId);
						return;
					}

					if (parsedMessage.type === 'ack' && parsedMessage.ackId?.startsWith('heartbeat-')) {
						socketService.handleHeartbeatPong(connectionId);
						return;
					}

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
			close(webSocket: ServerWebSocket<{ connectionId: string }>) {
				const connectionId = webSocket.data.connectionId;

				// 廣播游標離開事件（必須在 cleanupSocket 前執行，否則 room 資訊已被清除）
				broadcastCursorLeft(connectionId);

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
