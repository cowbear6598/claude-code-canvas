import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';

// 取得當前模組的目錄路徑（ESM 模式）
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 前端靜態檔案目錄（相對於 backend 根目錄）
const FRONTEND_DIST_PATH = path.resolve(__dirname, '../../../frontend/dist');

/**
 * 根據副檔名取得 MIME Type
 */
function getMimeType(filePath: string): string {
	const ext = path.extname(filePath).toLowerCase();
	const mimeTypes: Record<string, string> = {
		'.html': 'text/html',
		'.js': 'application/javascript',
		'.css': 'text/css',
		'.json': 'application/json',
		'.svg': 'image/svg+xml',
		'.png': 'image/png',
		'.jpg': 'image/jpeg',
		'.jpeg': 'image/jpeg',
		'.gif': 'image/gif',
		'.ico': 'image/x-icon',
		'.woff': 'font/woff',
		'.woff2': 'font/woff2',
		'.ttf': 'font/ttf',
		'.eot': 'application/vnd.ms-fontobject',
		'.webp': 'image/webp',
		'.webm': 'video/webm',
		'.mp4': 'video/mp4',
	};
	return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * 檢查靜態檔案目錄是否存在
 */
export async function isStaticFilesAvailable(): Promise<boolean> {
	try {
		const indexFile = Bun.file(path.join(FRONTEND_DIST_PATH, 'index.html'));
		return await indexFile.exists();
	} catch {
		return false;
	}
}

/**
 * 處理靜態檔案請求
 * @param request HTTP 請求
 * @returns Response 回應
 */
export async function serveStaticFile(request: Request): Promise<Response> {
	try {
		const url = new URL(request.url);
		let pathname = url.pathname;

		// 預設首頁
		if (pathname === '/') {
			pathname = '/index.html';
		}

		// 防止路徑穿越攻擊
		const safePath = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '');
		const filePath = path.join(FRONTEND_DIST_PATH, safePath);
		const resolvedPath = path.resolve(filePath);

		// 確保請求的路徑在允許的目錄內
		if (!resolvedPath.startsWith(FRONTEND_DIST_PATH)) {
			return new Response('Forbidden', { status: 403 });
		}

		// 嘗試讀取檔案
		const file = Bun.file(resolvedPath);
		const exists = await file.exists();

		if (exists) {
			// eslint-disable-next-line no-undef
			const headers = new Headers({
				'Content-Type': getMimeType(resolvedPath),
				'X-Content-Type-Options': 'nosniff',
			});

			// 對 /assets/ 下的檔案加上快取 header（Vite 會在檔名加 hash）
			if (pathname.startsWith('/assets/')) {
				headers.set('Cache-Control', 'public, max-age=31536000, immutable');
			}

			return new Response(file, { headers });
		}

		// SPA fallback：對於不存在的路徑，回傳 index.html
		const indexFile = Bun.file(path.join(FRONTEND_DIST_PATH, 'index.html'));
		const indexExists = await indexFile.exists();

		if (indexExists) {
			return new Response(indexFile, {
				headers: {
					'Content-Type': 'text/html',
					'X-Content-Type-Options': 'nosniff',
				},
			});
		}

		// 如果連 index.html 都不存在，回傳 404
		return new Response('Not Found', { status: 404 });
	} catch (error) {
		logger.error('Startup', 'Error', '靜態檔案服務錯誤', error);
		return new Response('Internal Server Error', { status: 500 });
	}
}
