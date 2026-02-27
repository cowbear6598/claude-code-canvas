import { buildEmbeddedFileMap, serveFromEmbeddedMap } from '../../src/utils/staticFileServer.js';

function createMockBlob(name: string, content: string, type: string): Blob {
	const blob = new Blob([content], { type });
	Object.defineProperty(blob, 'name', { value: name, writable: false });
	return blob;
}

function buildMockFileMap(): Map<string, Blob> {
	const indexBlob = createMockBlob('index.html', '<html><body>App</body></html>', 'text/html');
	const jsBlob = createMockBlob(
		'assets/index-abc123.js',
		'console.log("hello")',
		'application/javascript',
	);
	const cssBlob = createMockBlob('assets/index-abc123.css', 'body { color: red; }', 'text/css');

	return buildEmbeddedFileMap([indexBlob, jsBlob, cssBlob]);
}

describe('靜態檔案服務（Compile 模式）', () => {
	describe('buildEmbeddedFileMap', () => {
		it('應該將 blob.name 對應到 /blob.name 的 key', () => {
			const blob = createMockBlob('index.html', '<html/>', 'text/html');
			const map = buildEmbeddedFileMap([blob]);

			expect(map.has('/index.html')).toBe(true);
			expect(map.get('/index.html')).toBe(blob);
		});

		it('應該處理已有 / 前綴的 blob.name', () => {
			const blob = createMockBlob('/index.html', '<html/>', 'text/html');
			const map = buildEmbeddedFileMap([blob]);

			expect(map.has('/index.html')).toBe(true);
			expect(map.get('/index.html')).toBe(blob);
		});

		it('應該將含路徑的 blob.name 對應到正確的 key', () => {
			const blob = createMockBlob('assets/index-abc123.js', 'js content', 'application/javascript');
			const map = buildEmbeddedFileMap([blob]);

			expect(map.has('/assets/index-abc123.js')).toBe(true);
		});

		it('空陣列應回傳空 Map', () => {
			const map = buildEmbeddedFileMap([]);
			expect(map.size).toBe(0);
		});
	});

	describe('serveFromEmbeddedMap', () => {
		it('根路徑 / 應回傳 index.html 的內容', async () => {
			const fileMap = buildMockFileMap();
			const request = new Request('http://localhost:3001/');
			const response = serveFromEmbeddedMap(request, fileMap);

			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('text/html');
		});

		it('應回傳對應路徑的靜態資源', async () => {
			const fileMap = buildMockFileMap();
			const request = new Request('http://localhost:3001/assets/index-abc123.js');
			const response = serveFromEmbeddedMap(request, fileMap);

			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('application/javascript');
		});

		it('assets 路徑下的資源應設定快取 header', () => {
			const fileMap = buildMockFileMap();
			const request = new Request('http://localhost:3001/assets/index-abc123.js');
			const response = serveFromEmbeddedMap(request, fileMap);

			const cacheControl = response.headers.get('Cache-Control');
			expect(cacheControl).toContain('max-age=31536000');
			expect(cacheControl).toContain('immutable');
		});

		it('應設定 X-Content-Type-Options 安全 header', () => {
			const fileMap = buildMockFileMap();
			const request = new Request('http://localhost:3001/');
			const response = serveFromEmbeddedMap(request, fileMap);

			expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
		});

		it('SPA fallback：不存在的路徑應回傳 index.html', async () => {
			const fileMap = buildMockFileMap();
			const request = new Request('http://localhost:3001/some/non-existent/route');
			const response = serveFromEmbeddedMap(request, fileMap);

			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('text/html');
		});

		it('連 index.html 都不存在時應回傳 404', () => {
			const emptyMap = new Map<string, Blob>();
			const request = new Request('http://localhost:3001/non-existent');
			const response = serveFromEmbeddedMap(request, emptyMap);

			expect(response.status).toBe(404);
		});
	});
});
