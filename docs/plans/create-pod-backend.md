# 透過 REST API 建立 Pod - 後端實作計畫

## 測試案例清單

在 `/Users/cowbear6598/Desktop/claude-code-canvas/backend/tests/integration/pod-api.test.ts` 中新增 `describe('POST /api/canvas/:id/pods')` 區塊，包含以下測試：

1. 成功建立 Pod（只傳 name, x, y），預設 model 為 opus
2. 成功建立 Pod 並指定 model 為 sonnet
3. 用 canvas name 建立 Pod
4. 缺少 name 回傳 400
5. name 為空字串回傳 400
6. name 超過 100 字元回傳 400
7. 缺少 x 或 y 回傳 400
8. 無效 model 回傳 400
9. Canvas 不存在回傳 404
10. 無效 JSON body 回傳 400
11. 回傳的 Pod 包含完整欄位且 color 為 blue、rotation 為 0

---

## 實作步驟

### 1. 建立共用模組 `apiHelpers.ts`

- [ ] 新建 `/Users/cowbear6598/Desktop/claude-code-canvas/backend/src/api/apiHelpers.ts`
  - 從 `canvasApi.ts` 搬移 `jsonResponse` 函式到此檔案，並 export
  - 從 `canvasApi.ts` 搬移 `resolveCanvas` 函式到此檔案，並 export
  - 從 `canvasApi.ts` 搬移 `UUID_REGEX` 常數到此檔案（`resolveCanvas` 依賴此常數）
  - 保留 `canvasApi.ts` 中的 import：`canvasStore`, `Canvas` type（`resolveCanvas` 需要）

### 2. 更新 `canvasApi.ts` 改為從 `apiHelpers.ts` 引入

- [ ] 修改 `/Users/cowbear6598/Desktop/claude-code-canvas/backend/src/api/canvasApi.ts`
  - 移除 `UUID_REGEX` 常數定義
  - 移除 `jsonResponse` 函式定義
  - 移除 `resolveCanvas` 函式定義
  - 新增 `import { jsonResponse, resolveCanvas } from './apiHelpers.js'`
  - 其餘程式碼不變

### 3. 新建 `podApi.ts`

- [ ] 新建 `/Users/cowbear6598/Desktop/claude-code-canvas/backend/src/api/podApi.ts`
  - import `jsonResponse`, `resolveCanvas` from `./apiHelpers.js`
  - import `podStore` from `../services/podStore.js`
  - import `socketService` from `../services/socketService.js`
  - import `workspaceService` from `../services/workspace/index.js`
  - import `WebSocketResponseEvents` from `../schemas/index.js`
  - import `ModelType` type from `../types/pod.js`

#### 3a. 搬移 `handleListPods` 到 `podApi.ts`

- [ ] 將 `canvasApi.ts` 中的 `handleListPods` 函式搬移到 `podApi.ts`，並從 `canvasApi.ts` 移除 export
  - `podApi.ts` 中 export `handleListPods`

#### 3b. 實作 `handleCreatePod` handler

- [ ] 在 `podApi.ts` 中新增 `handleCreatePod` async handler，簽名為 `(req: Request, params: Record<string, string>) => Promise<Response>`
  - 定義合法 model 陣列：`['opus', 'sonnet', 'haiku']`
  - 驗證流程依序如下：
    1. 用 `try/catch` 解析 `await req.json()`，失敗回傳 `jsonResponse({ error: '無效的請求格式' }, 400)`
    2. 用 `resolveCanvas(params.id)` 解析 canvas，找不到回傳 `jsonResponse({ error: '找不到 Canvas' }, 404)`
    3. 檢查 `body.name` 存在且為 string，否則回傳 `jsonResponse({ error: 'Pod 名稱不能為空' }, 400)`
    4. 檢查 `body.name` trim 後不為空字串，否則回傳 `jsonResponse({ error: 'Pod 名稱不能為空' }, 400)`
    5. 檢查 `body.name` 長度不超過 100，否則回傳 `jsonResponse({ error: 'Pod 名稱不能超過 100 個字元' }, 400)`
    6. 檢查 `body.x` 和 `body.y` 存在且為 number 型別，否則回傳 `jsonResponse({ error: '必須提供 x 和 y 座標' }, 400)`
    7. 如果 `body.model` 有提供，檢查是否在合法 model 陣列中，否則回傳 `jsonResponse({ error: '無效的模型類型' }, 400)`
  - 驗證通過後：
    1. 呼叫 `podStore.create(canvas.id, { name: body.name, color: 'blue', x: body.x, y: body.y, rotation: 0, model: body.model ?? 'opus' })`
    2. 呼叫 `await workspaceService.createWorkspace(createdPod.workspacePath)` 建立 workspace 目錄
    3. 呼叫 `socketService.emitToCanvas(canvas.id, WebSocketResponseEvents.POD_CREATED, { requestId: 'system', success: true, pod: createdPod })`
    4. 回傳 `jsonResponse({ pod: createdPod }, 201)`

### 4. 更新 API Router

- [ ] 修改 `/Users/cowbear6598/Desktop/claude-code-canvas/backend/src/api/apiRouter.ts`
  - 將 `handleListPods` 的 import 來源從 `./canvasApi.js` 改為 `./podApi.js`
  - 新增 import `handleCreatePod` from `./podApi.js`
  - 在 ROUTES 陣列中，於 `GET /api/canvas/:id/pods` 之後新增一筆路由：
    - `{ method: 'POST', pattern: new URLPattern({ pathname: '/api/canvas/:id/pods' }), handler: handleCreatePod }`

### 5. 更新測試

- [ ] 在 `/Users/cowbear6598/Desktop/claude-code-canvas/backend/tests/helpers/canvasHelper.ts` 中新增 `postPod` helper 函式
  - 簽名：`postPod(baseUrl: string, canvasId: string, body: unknown, contentType?: string) => Promise<Response>`
  - 發送 `POST` 請求到 `${baseUrl}/api/canvas/${canvasId}/pods`
  - 預設 Content-Type 為 `application/json`，body 用 `JSON.stringify` 序列化
  - 如果 contentType 不是 `application/json`，body 用 `String()` 轉換

- [ ] 在 `/Users/cowbear6598/Desktop/claude-code-canvas/backend/tests/integration/pod-api.test.ts` 中新增測試
  - import `postPod` from helpers
  - 新增 `describe('POST /api/canvas/:id/pods')` 區塊
  - 使用與現有 `describe('GET /api/canvas/:id/pods')` 相同的 `beforeAll` / `afterAll` 模式（createTestServer, createSocketClient, disconnectSocket, closeTestServer）
  - 測試內容如下：

  **測試 1：成功建立 Pod（只傳 name, x, y）**
  - 呼叫 `postPod(server.baseUrl, server.canvasId, { name: 'REST Pod', x: 100, y: 200 })`
  - 驗證 response status 為 201
  - 驗證 body.pod 存在
  - 驗證 body.pod.name 為 'REST Pod'
  - 驗證 body.pod.x 為 100, body.pod.y 為 200
  - 驗證 body.pod.color 為 'blue'
  - 驗證 body.pod.rotation 為 0
  - 驗證 body.pod.model 為 'opus'（預設值）

  **測試 2：成功建立 Pod 並指定 model**
  - 呼叫 `postPod` 傳入 `{ name: 'Sonnet Pod', x: 0, y: 0, model: 'sonnet' }`
  - 驗證 response status 為 201
  - 驗證 body.pod.model 為 'sonnet'

  **測試 3：用 canvas name 建立 Pod**
  - 先用 `postCanvas` 建立一個有特定 name 的 canvas
  - 用 canvas name（而非 UUID）呼叫 `postPod`
  - 驗證 response status 為 201

  **測試 4：缺少 name 回傳 400**
  - 呼叫 `postPod` 傳入 `{ x: 0, y: 0 }`（沒有 name）
  - 驗證 response status 為 400
  - 驗證 body.error 為 'Pod 名稱不能為空'

  **測試 5：name 為空字串回傳 400**
  - 呼叫 `postPod` 傳入 `{ name: '', x: 0, y: 0 }`
  - 驗證 response status 為 400
  - 驗證 body.error 為 'Pod 名稱不能為空'

  **測試 6：name 超過 100 字元回傳 400**
  - 呼叫 `postPod` 傳入 `{ name: 'a'.repeat(101), x: 0, y: 0 }`
  - 驗證 response status 為 400
  - 驗證 body.error 為 'Pod 名稱不能超過 100 個字元'

  **測試 7：缺少 x 或 y 回傳 400**
  - 呼叫 `postPod` 傳入 `{ name: 'Pod', y: 0 }`（缺 x）
  - 驗證 response status 為 400
  - 驗證 body.error 為 '必須提供 x 和 y 座標'
  - 呼叫 `postPod` 傳入 `{ name: 'Pod', x: 0 }`（缺 y）
  - 驗證 response status 為 400
  - 驗證 body.error 為 '必須提供 x 和 y 座標'

  **測試 8：無效 model 回傳 400**
  - 呼叫 `postPod` 傳入 `{ name: 'Pod', x: 0, y: 0, model: 'gpt-4' }`
  - 驗證 response status 為 400
  - 驗證 body.error 為 '無效的模型類型'

  **測試 9：Canvas 不存在回傳 404**
  - 呼叫 `postPod` 使用不存在的 canvas id（例如 'non-existent-canvas'）
  - 驗證 response status 為 404
  - 驗證 body.error 為 '找不到 Canvas'

  **測試 10：無效 JSON body 回傳 400**
  - 呼叫 `postPod` 傳入非 JSON 字串（contentType 設為 'text/plain'，body 為 'not json'）
  - 驗證 response status 為 400
  - 驗證 body.error 為 '無效的請求格式'

  **測試 11：回傳的 Pod 包含完整欄位**
  - 呼叫 `postPod` 建立一個 Pod
  - 驗證 body.pod 包含以下欄位及型別：
    - id: string
    - name: string
    - color: 'blue'
    - status: 'idle'
    - workspacePath: string
    - x: number
    - y: number
    - rotation: 0
    - model: string
    - createdAt: string（合法 ISO 日期）
    - lastActiveAt: string（合法 ISO 日期）
    - skillIds: array
    - subAgentIds: array
    - mcpServerIds: array
    - needsForkSession: boolean
    - autoClear: boolean

### 6. 更新 Skill 文件

- [ ] 更新 `/Users/cowbear6598/Desktop/claude-code-canvas/skill/claude-code-canvas/references/pod-api.md`
  - 保留現有的 `GET /api/canvas/:id/pods` 區塊
  - 新增 `POST /api/canvas/:id/pods` 區塊，包含：
    - 說明：在指定 Canvas 下建立新 Pod，`:id` 支援 UUID 或 name
    - Request Body 說明：
      - name (string, 必填)：Pod 名稱，1-100 字元
      - x (number, 必填)：X 座標
      - y (number, 必填)：Y 座標
      - model (string, 選填)：模型類型，可選 opus / sonnet / haiku，預設 opus
    - 補充說明：Pod 尺寸為 224x168 px，建議 Pod 之間保持 20px 間距
    - 成功回應 201 範例：`{ "pod": { "id": "...", "name": "...", ... } }`
    - 錯誤回應範例：400 / 404
    - curl 範例

- [ ] 更新 `/Users/cowbear6598/Desktop/claude-code-canvas/skill/claude-code-canvas/SKILL.md`
  - 在 Pod 快速索引表中新增一行：`| POST | /api/canvas/:id/pods | 在指定畫布建立新 Pod（:id 支援 UUID 或 name） |`

### 7. 執行驗證

- [ ] 執行 `bun run test` 確認所有測試通過
- [ ] 執行 `bun run style` 確認 eslint 和 type 檢查通過
