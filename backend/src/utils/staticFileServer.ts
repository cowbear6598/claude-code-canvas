import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
 * 判斷目前是否為 compile 模式（bun build --compile 產出的單一執行檔）
 * 透過檢查 Bun.embeddedFiles 是否有內容來判斷
 */
export function isCompiledMode(): boolean {
	return Bun.embeddedFiles.length > 0;
}

// Bun 的 embeddedFiles 在 runtime 中，每個 Blob 都有 name 屬性，
// 但型別定義僅為標準 Blob，因此需要自訂介面來存取 name
interface NamedBlob extends Blob {
	readonly name: string;
}

/**
 * 從 Bun.embeddedFiles 建立 URL 路徑到 Blob 的 Map
 * key 為 URL 路徑（例如 /index.html、/assets/index-abc123.js）
 */
export function buildEmbeddedFileMap(files: ReadonlyArray<Blob>): Map<string, Blob> {
	const map = new Map<string, Blob>();

	for (const blob of files) {
		const namedBlob = blob as NamedBlob;
		// namedBlob.name 為檔案名稱（可能含路徑），例如 index.html 或 assets/index-abc123.js
		// 統一加上 / 前綴作為 URL 路徑的 key
		const key = namedBlob.name.startsWith('/') ? namedBlob.name : `/${namedBlob.name}`;
		map.set(key, blob);
	}

	return map;
}

// compile 模式下，在模組載入時建立嵌入檔案的 Map
const embeddedFileMap = buildEmbeddedFileMap(Bun.embeddedFiles);

/**
 * 從嵌入檔案 Map 中提供靜態檔案回應（compile 模式專用）
 */
export function serveFromEmbeddedMap(request: Request, fileMap: Map<string, Blob>): Response {
	const url = new URL(request.url);
	const pathname = url.pathname === '/' ? '/index.html' : url.pathname;

	const blob = fileMap.get(pathname);

	if (blob) {
		const headers = new Headers({
			'Content-Type': getMimeType(pathname),
			'X-Content-Type-Options': 'nosniff',
		});

		if (pathname.startsWith('/assets/')) {
			headers.set('Cache-Control', 'public, max-age=31536000, immutable');
		}

		return new Response(blob, { headers });
	}

	// SPA fallback：找不到的路徑回傳 index.html
	const indexBlob = fileMap.get('/index.html');

	if (indexBlob) {
		return new Response(indexBlob, {
			headers: {
				'Content-Type': 'text/html',
				'X-Content-Type-Options': 'nosniff',
			},
		});
	}

	return new Response('Not Found', { status: 404 });
}

/**
 * 檢查靜態檔案是否可用
 */
export async function isStaticFilesAvailable(): Promise<boolean> {
	if (isCompiledMode()) {
		return embeddedFileMap.has('/index.html');
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
	if (isCompiledMode()) {
		return serveFromEmbeddedMap(request, embeddedFileMap);
	}

	return serveFromFilesystem(request);
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
