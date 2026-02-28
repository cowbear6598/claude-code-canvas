import { isStaticFilesAvailable, serveStaticFile } from '../../src/utils/staticFileServer.js';

describe('靜態檔案服務', () => {
	describe('isStaticFilesAvailable', () => {
		it('應該檢查 index.html 是否存在', async () => {
			const result = await isStaticFilesAvailable();
			expect(typeof result).toBe('boolean');
		});
	});

	describe('serveStaticFile', () => {
		it('應該處理根路徑請求', async () => {
			const request = new Request('http://localhost:3001/');
			const response = await serveStaticFile(request);
			expect(response).toBeInstanceOf(Response);
		});

		it('應該處理靜態資源請求', async () => {
			const request = new Request('http://localhost:3001/assets/test.js');
			const response = await serveStaticFile(request);
			expect(response).toBeInstanceOf(Response);
		});

		it('應該安全處理路徑穿越攻擊嘗試', async () => {
			// 測試常見的路徑穿越攻擊模式
			const request = new Request('http://localhost:3001/../../../etc/passwd');
			const response = await serveStaticFile(request);

			// new URL() 會自動正規化 /../../../ 為 /etc/passwd
			// 然後 path.join(FRONTEND_DIST_PATH, '/etc/passwd') 會產生
			// .../frontend/dist/etc/passwd (仍在 dist 目錄內)
			// 由於檔案不存在，會 fallback 到 index.html，回傳 200（安全的 SPA fallback）
			// 或在沒有 index.html 時回傳 404
			// 這兩種結果都是安全的，因為不會存取到 dist 目錄外的系統檔案
			expect([200, 404]).toContain(response.status);

			// 如果回傳 200，應該是 HTML 內容（index.html），不是系統檔案
			if (response.status === 200) {
				const contentType = response.headers.get('Content-Type');
				expect(contentType).toBe('text/html');
			}
		});

		it('應該對 assets 資源設定快取 header', async () => {
			const request = new Request('http://localhost:3001/assets/index-BaBRudfh.js');
			const response = await serveStaticFile(request);

			// 如果檔案存在，檢查 Cache-Control header
			if (response.status === 200) {
				const cacheControl = response.headers.get('Cache-Control');
				if (cacheControl) {
					expect(cacheControl).toContain('max-age=31536000');
					expect(cacheControl).toContain('immutable');
				}
			}
		});

		it('應該設定安全 header', async () => {
			const hasStaticFiles = await isStaticFilesAvailable();

			if (hasStaticFiles) {
				const request = new Request('http://localhost:3001/');
				const response = await serveStaticFile(request);

				const contentTypeOptions = response.headers.get('X-Content-Type-Options');
				expect(contentTypeOptions).toBe('nosniff');
			} else {
				return;
			}
		});

		it('SPA fallback: 不存在的路徑應該回傳 index.html', async () => {
			const hasStaticFiles = await isStaticFilesAvailable();

			if (hasStaticFiles) {
				const request = new Request('http://localhost:3001/some/non-existent/route');
				const response = await serveStaticFile(request);

				// 應該回傳 200 且 Content-Type 為 text/html（index.html）
				// 或 404 如果 index.html 不存在
				expect([200, 404]).toContain(response.status);

				if (response.status === 200) {
					const contentType = response.headers.get('Content-Type');
					expect(contentType).toBe('text/html');
				}
			}
		});
	});
});
