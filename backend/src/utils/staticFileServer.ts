import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';
import { getMimeType } from './mimeTypes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIST_PATH = path.resolve(__dirname, '../../../frontend/dist');

type VFSData = Record<string, { content: string; mimeType: string }>;

let vfsData: VFSData | null = null;

try {
	const mod = await import('../generated/vfs.js');
	vfsData = mod.VFS ?? null;
} catch {
	vfsData = null;
}

/**
 * 檢查靜態檔案是否可用
 */
export async function isStaticFilesAvailable(): Promise<boolean> {
	if (vfsData !== null) {
		return vfsData['/index.html'] !== undefined;
	}

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
	if (vfsData !== null) {
		return serveFromVFS(request, vfsData);
	}

	return serveFromFilesystem(request);
}

export function serveFromVFS(
	request: Request,
	vfs: Record<string, { content: string; mimeType: string }>,
): Response {
	const url = new URL(request.url);
	const pathname = url.pathname === '/' ? '/index.html' : url.pathname;

	const entry = vfs[pathname];

	if (entry) {
		const headers = new Headers({
			'Content-Type': entry.mimeType,
			'X-Content-Type-Options': 'nosniff',
		});

		if (pathname.startsWith('/assets/')) {
			headers.set('Cache-Control', 'public, max-age=31536000, immutable');
		}

		return new Response(Buffer.from(entry.content, 'base64'), { headers });
	}

	// SPA fallback：找不到的路徑回傳 index.html
	const indexEntry = vfs['/index.html'];

	if (indexEntry) {
		return new Response(Buffer.from(indexEntry.content, 'base64'), {
			headers: {
				'Content-Type': 'text/html',
				'X-Content-Type-Options': 'nosniff',
			},
		});
	}

	return new Response('Not Found', { status: 404 });
}

async function serveFromFilesystem(request: Request): Promise<Response> {
	try {
		const url = new URL(request.url);
		let pathname = url.pathname;

		if (pathname === '/') {
			pathname = '/index.html';
		}

		// 防止路徑穿越攻擊
		const safePath = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '');
		const filePath = path.join(FRONTEND_DIST_PATH, safePath);
		const resolvedPath = path.resolve(filePath);

		if (!resolvedPath.startsWith(FRONTEND_DIST_PATH)) {
			return new Response('Forbidden', { status: 403 });
		}

		const file = Bun.file(resolvedPath);
		const exists = await file.exists();

		if (exists) {
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
