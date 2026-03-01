# 列出 Canvas 下所有 Pod - 後端實作計畫

## User Flow

### 正常流程
- 呼叫 `GET /api/canvas/:id/pods`，回傳該 Canvas 下所有 Pod 的完整資訊（200）
- Canvas 存在但目前沒有任何 Pod，回傳空陣列（200）

### 錯誤流程
- 傳入的 canvasId 不是合法 UUID 格式，回傳 400
- 傳入的 canvasId 找不到對應的 Canvas，回傳 404

---

## 測試案例

### `GET /api/canvas/:id/pods`

- 成功取得 Pod 列表（有資料）
- Canvas 存在但沒有 Pod 時回傳空陣列
- 回傳資料包含 Pod 完整欄位
- 無效的 Canvas ID 格式回傳 400
- 找不到 Canvas 回傳 404

---

## 實作步驟

- [ ] 在 `backend/src/api/canvasApi.ts` 新增 `handleListPods` handler 函式
  - 函式簽名：`export async function handleListPods(_req: Request, params: Record<string, string>): Promise<Response>`
  - 從 `params.id` 取得 `canvasId`
  - 使用已存在的 `UUID_REGEX` 驗證 canvasId 格式，不合法回傳 `{ error: '無效的 Canvas ID 格式' }` 與 status 400
  - 使用 `canvasStore.getById(canvasId)` 確認 Canvas 是否存在，不存在回傳 `{ error: '找不到 Canvas' }` 與 status 404
  - 使用 `podStore.getAll(canvasId)` 取得所有 Pod
  - 回傳 `{ pods: [...] }` 與 status 200
  - 需要在檔案頂部 import `podStore`

- [ ] 在 `backend/src/api/apiRouter.ts` 註冊新路由
  - 在 import 區塊加入 `handleListPods` 的 import（從 `./canvasApi.js`）
  - 在 `ROUTES` 陣列新增一筆路由：`{ method: 'GET', pattern: new URLPattern({ pathname: '/api/canvas/:id/pods' }), handler: handleListPods }`
  - 此路由需放在 `DELETE /api/canvas/:id` 之前，避免 URLPattern 匹配順序問題（`:id` 可能匹配到 `:id/pods` 的 id 部分，但因為 DELETE 是不同 method 所以實際上放哪裡都不影響，但為了可讀性建議放在 DELETE 之前）

- [ ] 建立整合測試 `backend/tests/integration/pod-api.test.ts`
  - 使用與 `canvas-api.test.ts` 相同的測試架構：`createTestServer`、`createSocketClient`、`disconnectSocket`、`closeTestServer`
  - import `createPod` 從 `../helpers`
  - 建立 helper 函式 `fetchPods(baseUrl: string, canvasId: string)` 封裝 `fetch(\`${baseUrl}/api/canvas/${canvasId}/pods\`)` 呼叫
  - describe `GET /api/canvas/:id/pods`
    - 測試「成功取得 Pod 列表」：透過 WebSocket `createPod` 建立一個 Pod 後，呼叫 API 驗證 response status 為 200、`body.pods` 為陣列且長度大於 0
    - 測試「Canvas 存在但沒有 Pod 時回傳空陣列」：建立一個新的 Canvas（透過 REST API `POST /api/canvas`），用該 Canvas ID 呼叫 API，驗證 `body.pods` 為空陣列
    - 測試「回傳資料包含 Pod 完整欄位」：建立一個 Pod 後呼叫 API，驗證回傳的 Pod 物件包含以下欄位且型別正確：`id`(string)、`name`(string)、`color`(string)、`status`(string)、`workspacePath`(string)、`x`(number)、`y`(number)、`rotation`(number)、`createdAt`(string，ISO 8601 格式)、`lastActiveAt`(string，ISO 8601 格式)、`skillIds`(array)、`subAgentIds`(array)、`mcpServerIds`(array)、`model`(string)、`needsForkSession`(boolean)、`autoClear`(boolean)
    - 測試「無效的 Canvas ID 格式回傳 400」：用 `non-valid-id` 呼叫 API，驗證 status 400、`body.error` 為 `'無效的 Canvas ID 格式'`
    - 測試「找不到 Canvas 回傳 404」：用一個合法但不存在的 UUID `00000000-0000-4000-8000-000000000000` 呼叫 API，驗證 status 404、`body.error` 為 `'找不到 Canvas'`

- [ ] 更新 Skill 文件 `skill/claude-code-canvas/references/canvas-api.md`
  - 在 `DELETE /api/canvas/:id` 區塊之後新增 `GET /api/canvas/:id/pods` 區塊
  - 包含以下內容：
    - 說明：取得指定 Canvas 下所有 Pod
    - 路徑參數表：id (string UUID) - Canvas 的唯一識別碼
    - 成功回應 200（有資料）：`{ "pods": [Pod物件] }`
    - 成功回應 200（空陣列）：`{ "pods": [] }`
    - 錯誤回應 400：`{ "error": "無效的 Canvas ID 格式" }`
    - 錯誤回應 404：`{ "error": "找不到 Canvas" }`
    - curl 範例
    - JavaScript fetch 範例

- [ ] 執行 `bun run test` 確認所有測試通過
- [ ] 執行 `bun run style` 確認 eslint 與 type 檢查通過
