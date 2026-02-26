import { handleListCanvases, handleCreateCanvas } from './canvasApi.js';
import { JSON_HEADERS } from './constants.js';
import { logger } from '../utils/logger.js';

type ApiHandler = (req: Request) => Response | Promise<Response>;

const ROUTES: Record<string, ApiHandler> = {
	'GET /api/canvas/list': handleListCanvases,
	'POST /api/canvas': handleCreateCanvas,
};

export async function handleApiRequest(req: Request): Promise<Response | null> {
	const url = new URL(req.url);

	if (!url.pathname.startsWith('/api/')) {
		return null;
	}

	try {
		const routeKey = `${req.method} ${url.pathname}`;
		const handler = ROUTES[routeKey];

		if (!handler) {
			return new Response(JSON.stringify({ error: '找不到 API 路徑' }), {
				status: 404,
				headers: JSON_HEADERS,
			});
		}

		return await handler(req);
	} catch (error) {
		logger.error('Canvas', 'Error', '處理 API 請求時發生錯誤', error);
		return new Response(JSON.stringify({ error: '伺服器內部錯誤' }), {
			status: 500,
			headers: JSON_HEADERS,
		});
	}
}
