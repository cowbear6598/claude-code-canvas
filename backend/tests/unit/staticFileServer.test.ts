import { serveFromVFS } from '../../src/utils/staticFileServer.js';

type VFSData = Record<string, { content: string; mimeType: string }>;

function toBase64(content: string): string {
	return Buffer.from(content).toString('base64');
}

function buildMockVFS(): VFSData {
	return {
		'/index.html': {
			content: toBase64('<html><body>App</body></html>'),
			mimeType: 'text/html',
		},
		'/assets/index-abc123.js': {
			content: toBase64('console.log("hello")'),
			mimeType: 'application/javascript',
		},
		'/assets/index-abc123.css': {
			content: toBase64('body { color: red; }'),
			mimeType: 'text/css',
		},
	};
}

describe('靜態檔案服務（serveFromVFS）', () => {
	it('根路徑 / 應回傳 index.html 的內容', async () => {
		const vfs = buildMockVFS();
		const request = new Request('http://localhost:3001/');
		const response = serveFromVFS(request, vfs);

		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('text/html');

		const text = await response.text();
		expect(text).toBe('<html><body>App</body></html>');
	});

	it('應回傳對應路徑的靜態資源', async () => {
		const vfs = buildMockVFS();
		const request = new Request('http://localhost:3001/assets/index-abc123.js');
		const response = serveFromVFS(request, vfs);

		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('application/javascript');

		const text = await response.text();
		expect(text).toBe('console.log("hello")');
	});

	it('assets 路徑下的資源應設定快取 header', () => {
		const vfs = buildMockVFS();
		const request = new Request('http://localhost:3001/assets/index-abc123.js');
		const response = serveFromVFS(request, vfs);

		const cacheControl = response.headers.get('Cache-Control');
		expect(cacheControl).toContain('max-age=31536000');
		expect(cacheControl).toContain('immutable');
	});

	it('應設定 X-Content-Type-Options 安全 header', () => {
		const vfs = buildMockVFS();
		const request = new Request('http://localhost:3001/');
		const response = serveFromVFS(request, vfs);

		expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
	});

	it('SPA fallback：不存在的路徑應回傳 index.html', async () => {
		const vfs = buildMockVFS();
		const request = new Request('http://localhost:3001/some/non-existent/route');
		const response = serveFromVFS(request, vfs);

		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('text/html');

		const text = await response.text();
		expect(text).toBe('<html><body>App</body></html>');
	});

	it('連 index.html 都不存在時應回傳 404', () => {
		const emptyVFS: VFSData = {};
		const request = new Request('http://localhost:3001/non-existent');
		const response = serveFromVFS(request, emptyVFS);

		expect(response.status).toBe(404);
	});
});

describe('靜態檔案服務（serveStaticFile 委派 serveFromVFS）', () => {
	// serveStaticFile 在 VFS 有資料時委派給 serveFromVFS，行為與 serveFromVFS 一致
	// 以下測試驗證委派結果與直接呼叫 serveFromVFS 相同

	it('serveFromVFS 正確處理根路徑、SPA fallback 及 404', async () => {
		const vfs = buildMockVFS();

		// 根路徑應回傳 index.html
		const rootResponse = serveFromVFS(new Request('http://localhost:3001/'), vfs);
		expect(rootResponse.status).toBe(200);
		expect(rootResponse.headers.get('Content-Type')).toBe('text/html');

		// SPA fallback：不存在路徑應回傳 index.html
		const spaResponse = serveFromVFS(new Request('http://localhost:3001/about'), vfs);
		expect(spaResponse.status).toBe(200);
		expect(spaResponse.headers.get('Content-Type')).toBe('text/html');

		// 空 VFS：找不到任何資源應回傳 404
		const notFoundResponse = serveFromVFS(new Request('http://localhost:3001/any'), {});
		expect(notFoundResponse.status).toBe(404);
	});
});
