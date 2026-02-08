# Frontend 邏輯測試計畫書

本計畫書為 Agent Canvas 前端應用建立完整的邏輯測試，涵蓋所有 Stores、Composables、Utils 層級，WebSocket 通訊完全 Mock。

---

## 目錄

1. [測試基礎設施設定](#1-測試基礎設施設定)
2. [Mock 與 Factory 設計](#2-mock-與-factory-設計)
3. [Phase 1：基礎設施 + Utils 測試](#3-phase-1基礎設施--utils-測試)
4. [Phase 2：Core Stores 測試](#4-phase-2core-stores-測試)
5. [Phase 3：Note Stores 測試](#5-phase-3note-stores-測試)
6. [Phase 4：Chat Store 測試](#6-phase-4chat-store-測試)
7. [Phase 5：Composables 測試](#7-phase-5composables-測試)
8. [Phase 6：整合測試](#8-phase-6整合測試)
9. [測試命名規範與風格](#9-測試命名規範與風格)
10. [重構計畫](#10-重構計畫)

---

## 1. 測試基礎設施設定

### 1.1 安裝 npm 套件

在 `frontend/` 目錄下安裝以下 devDependencies：

- `vitest` - 測試框架
- `@pinia/testing` - Pinia Store 測試工具
- `@vue/test-utils` - Vue 元件/Composable 測試工具
- `jsdom` - 瀏覽器環境模擬（vitest environment）
- `@vitest/coverage-v8` - 覆蓋率報告

### 1.2 建立 `vitest.config.ts`

- [ ] 在 `frontend/vitest.config.ts` 建立 Vitest 設定檔
  - 繼承 `vite.config.ts` 的 resolve.alias 設定（`@` 指向 `./src`）
  - `test.environment` 設為 `jsdom`
  - `test.globals` 設為 `true`（全域 describe/it/expect）
  - `test.setupFiles` 指向 `tests/setup.ts`
  - `test.include` 設為 `['src/**/*.test.ts']`
  - `test.coverage.provider` 設為 `v8`
  - `test.coverage.include` 設為 `['src/stores/**', 'src/composables/**', 'src/utils/**', 'src/lib/**', 'src/services/**']`
  - `test.coverage.exclude` 設為 `['**/*.d.ts', '**/index.ts', '**/types/**']`

### 1.3 更新 `package.json` scripts

- [ ] 新增 `"test"` script：`vitest`
- [ ] 新增 `"test:run"` script：`vitest run`
- [ ] 新增 `"test:coverage"` script：`vitest run --coverage`

### 1.4 建立全域 setup 檔案

- [ ] 建立 `tests/setup.ts`
  - Mock `window.crypto.randomUUID`，使其回傳可預測的 UUID（使用計數器格式如 `test-uuid-1`, `test-uuid-2`）
  - Mock `window.crypto.getRandomValues`
  - Mock `window.requestAnimationFrame`，使其立即執行 callback
  - Mock `window.innerWidth` 和 `window.innerHeight`（設為 1920x1080）
  - Mock `console.warn` 和 `console.error` 為 `vi.fn()`（避免測試雜訊，但保留可驗證性）
  - 在 `beforeEach` 中呼叫 `vi.clearAllMocks()`

### 1.5 測試目錄結構

```
tests/
  setup.ts                          # 全域 setup
  helpers/
    mockWebSocket.ts                # WebSocket Mock 工具
    mockStoreFactory.ts             # Store 初始化 helper
    factories.ts                    # 測試資料工廠
  stores/
    canvasStore.test.ts
    podStore.test.ts
    connectionStore.test.ts
    selectionStore.test.ts
    viewportStore.test.ts
    clipboardStore.test.ts
    chat/
      chatStore.test.ts
      chatMessageActions.test.ts
      chatConnectionActions.test.ts
      chatHistoryActions.test.ts
    note/
      createNoteStore.test.ts
      outputStyleStore.test.ts
      skillStore.test.ts
      repositoryStore.test.ts
      subAgentStore.test.ts
      commandStore.test.ts
      createResourceCRUDActions.test.ts
  composables/
    canvas/
      useBoxSelect.test.ts
      useBatchDrag.test.ts
      useCopyPaste.test.ts
      useDeleteSelection.test.ts
      useCanvasPan.test.ts
      useCanvasZoom.test.ts
    pod/
      useSlotDropTarget.test.ts
      useSlotEject.test.ts
    useConnectionPath.test.ts
    useToast.test.ts
    useWebSocketErrorHandler.test.ts
  utils/
    gitUrlParser.test.ts
    scheduleUtils.test.ts
    errorSanitizer.test.ts
    keyboardHelpers.test.ts
    domHelpers.test.ts
  lib/
    sanitize.test.ts
  services/
    createWebSocketRequest.test.ts
    WebSocketClient.test.ts
  integration/
    canvasPodFlow.test.ts
    chatFlow.test.ts
    copyPasteFlow.test.ts
```

---

## 2. Mock 與 Factory 設計

### 2.1 WebSocket Mock 工具

- [ ] 建立 `tests/helpers/mockWebSocket.ts`

**Mock 對象**：`@/services/websocket` 模組整體

需提供以下 Mock 功能：

1. **`mockCreateWebSocketRequest`**
   - 攔截 `createWebSocketRequest` 呼叫
   - 根據 `requestEvent` 返回預設回應
   - 支援設定成功回應：`mockWebSocket.onRequest(requestEvent, responsePayload)`
   - 支援設定失敗回應：`mockWebSocket.onRequestError(requestEvent, errorMessage)`
   - 支援設定超時：`mockWebSocket.onRequestTimeout(requestEvent)`
   - 記錄所有請求，可透過 `mockWebSocket.getRequests(requestEvent)` 查詢呼叫參數

2. **`mockWebSocketClient`**
   - `emit` 記錄所有發送的事件，可查詢：`mockWebSocket.getEmitted(eventName)`
   - `on` / `off` 記錄監聽器註冊/取消
   - `isConnected` 為 `ref(true)`（預設已連線）
   - 提供 `simulateEvent(eventName, payload)` 方法，模擬後端推送事件給前端（觸發透過 `on` 註冊的 callback）
   - 提供 `simulateDisconnect(reason)` 方法，觸發所有 disconnect listener
   - `connect` / `disconnect` 為 `vi.fn()`

3. **`resetMockWebSocket()`** - 在 `beforeEach` 中重置所有 Mock 狀態

4. **使用方式**：在每個測試檔案頂部
   ```
   vi.mock('@/services/websocket', () => /* 回傳 mockWebSocket 匯出 */)
   ```
   - `createWebSocketRequest` 回傳 Mock 版本
   - `websocketClient` 回傳 Mock 版本
   - `WebSocketRequestEvents` 和 `WebSocketResponseEvents` 回傳真實值（從 `@/types/websocket/events` 取得）

### 2.2 測試資料工廠

- [ ] 建立 `tests/helpers/factories.ts`

每個工廠函數接受可選的 partial override 參數，未提供的欄位使用預設值。

1. **`createMockCanvas(overrides?)`**
   - 預設值：`{ id: 'canvas-1', name: 'Test Canvas', sortIndex: 0, createdAt: '2024-01-01T00:00:00Z' }`

2. **`createMockPod(overrides?)`**
   - 預設值：`{ id: 'pod-1', name: 'Test Pod', color: 'blue', x: 100, y: 150, rotation: 0.5, output: [], model: 'opus', autoClear: false, outputStyleId: null, repositoryId: null, commandId: null, skillIds: [], subAgentIds: [], schedule: null, status: 'idle' }`

3. **`createMockConnection(overrides?)`**
   - 預設值：`{ id: 'conn-1', sourcePodId: 'pod-1', sourceAnchor: 'bottom', targetPodId: 'pod-2', targetAnchor: 'top', triggerMode: 'auto', status: 'idle', createdAt: new Date(), decideReason: undefined }`

4. **`createMockMessage(overrides?)`**
   - 預設值：`{ id: 'msg-1', role: 'user', content: 'Hello', timestamp: '2024-01-01T00:00:00Z', isPartial: false }`

5. **`createMockAssistantMessage(overrides?)`**
   - 預設值：包含 `subMessages` 陣列，`role: 'assistant'`

6. **`createMockToolUseInfo(overrides?)`**
   - 預設值：`{ toolUseId: 'tool-1', toolName: 'test_tool', input: {}, status: 'running' }`

7. **`createMockNote(type, overrides?)`**
   - type 為 `'outputStyle' | 'skill' | 'repository' | 'subAgent' | 'command'`
   - 預設值包含 `id`, `name`, `x`, `y`, `boundToPodId: null`, `originalPosition: null`，以及對應的 itemId 欄位（如 `outputStyleId`, `skillId` 等）

8. **`createMockSchedule(overrides?)`**
   - 預設值：`{ frequency: 'every-day', hour: 9, minute: 0, enabled: true, weekdays: [], intervalMinute: 0, intervalHour: 0, lastTriggeredAt: null }`

9. **`createMockCopiedPod(overrides?)`**
   - 預設值：基於 `createMockPod` 但僅包含複製貼上需要的欄位

10. **`createMockCopiedConnection(overrides?)`**
    - 預設值：基於 `createMockConnection` 但僅包含複製貼上需要的欄位

### 2.3 Store 初始化 Helper

- [ ] 建立 `tests/helpers/mockStoreFactory.ts`

提供以下 Helper：

1. **`setupTestPinia()`**
   - 呼叫 `createTestingPinia` 並設為 active
   - 設定 `stubActions: false`（讓 action 真正執行，我們 Mock WebSocket 層）
   - 回傳 pinia instance

2. **`setupStoreWithCanvas(canvasId?)`**
   - 呼叫 `setupTestPinia()`
   - 初始化 `canvasStore`，設定 `activeCanvasId` 為指定值（預設 `'canvas-1'`）
   - 設定 `canvases` 陣列包含一個對應的 Canvas
   - 回傳 `{ pinia, canvasStore }`

3. **`setupStoreWithPods(pods?, canvasId?)`**
   - 呼叫 `setupStoreWithCanvas(canvasId)`
   - 初始化 `podStore`，塞入指定的 pods（預設 2 個 Mock Pod）
   - 回傳 `{ pinia, canvasStore, podStore }`

---

## 3. Phase 1：基礎設施 + Utils 測試

### 3.1 `tests/utils/gitUrlParser.test.ts`

目標：`src/utils/gitUrlParser.ts` 的 `detectGitPlatform`, `parseGitUrl`, `getPlatformDisplayName`

- [ ] describe `detectGitPlatform`
  - [ ] 應辨識 GitHub URL
  - [ ] 應辨識 GitLab URL
  - [ ] 不明網域應回傳 other
  - [ ] 大小寫不敏感

- [ ] describe `parseGitUrl`
  - [ ] 應解析 HTTPS GitHub URL（`https://github.com/owner/repo`）
  - [ ] 應解析 HTTPS GitHub URL 帶 .git 後綴
  - [ ] 應解析 SSH GitHub URL（`git@github.com:owner/repo.git`）
  - [ ] 應解析 SSH URL 不帶 .git 後綴
  - [ ] 應解析 GitLab URL
  - [ ] 空字串應回傳 isValid: false
  - [ ] 超過 500 字元的 URL 應回傳 isValid: false
  - [ ] 格式錯誤的 URL 應回傳 isValid: false
  - [ ] 應正確提取 owner 和 repoName

- [ ] describe `getPlatformDisplayName`
  - [ ] github 回傳 GitHub
  - [ ] gitlab 回傳 GitLab
  - [ ] other 回傳 Git

### 3.2 `tests/utils/scheduleUtils.test.ts`

目標：`src/utils/scheduleUtils.ts` 的 `formatScheduleFrequency`, `getNextTriggerTime`, `formatScheduleTooltip`

- [ ] describe `formatScheduleFrequency`
  - [ ] every-second 回傳「每秒」
  - [ ] every-x-minute 回傳「每 N 分鐘」（驗證 intervalMinute 插值）
  - [ ] every-x-hour 回傳「每 N 小時」（驗證 intervalHour 插值）
  - [ ] every-day 回傳「每天 HH:MM」（驗證零填充格式）
  - [ ] every-week 回傳「每週X、X HH:MM」（驗證 weekdays 排序、星期中文映射）
  - [ ] 未知頻率回傳「未知頻率」

- [ ] describe `getNextTriggerTime`
  - [ ] every-second：下次時間為 last + 1 秒（或 now + 1 秒如已過期）
  - [ ] every-x-minute：下次時間為 last + N 分鐘
  - [ ] every-x-hour：下次時間為 last + N 小時
  - [ ] every-day：如今天時間已過，回傳明天的同一時間
  - [ ] every-day：如今天時間未過，回傳今天的時間
  - [ ] every-week：回傳本週最近的一個符合 weekday 的時間
  - [ ] every-week：如本週所有 weekday 都已過，回傳下週第一個 weekday
  - [ ] every-week：weekdays 空陣列回傳 now + 1 分鐘
  - [ ] lastTriggeredAt 為 null 時以 now 作為基準

- [ ] describe `formatScheduleTooltip`
  - [ ] 格式為「頻率描述 | 下次：HH:MM」

### 3.3 `tests/utils/errorSanitizer.test.ts`

目標：`src/utils/errorSanitizer.ts` 的 `sanitizeErrorForUser`

- [ ] describe `sanitizeErrorForUser`
  - [ ] Error 物件提取 message 欄位
  - [ ] 字串直接使用
  - [ ] 含 message 屬性的物件提取 message
  - [ ] 其他型別回傳「未知錯誤」
  - [ ] 錯誤代碼映射（ECONNREFUSED -> 無法連線到伺服器 等 8 種）
  - [ ] 移除 Windows 檔案路徑
  - [ ] 移除 Unix 檔案路徑
  - [ ] 移除 Email
  - [ ] 移除 IP 地址
  - [ ] 移除長 Token/API Key
  - [ ] 移除堆疊追蹤
  - [ ] 超過 200 字元截斷並加 ...

### 3.4 `tests/utils/keyboardHelpers.test.ts`

目標：`src/utils/keyboardHelpers.ts` 的 `isCtrlOrCmdPressed`

- [ ] describe `isCtrlOrCmdPressed`
  - [ ] ctrlKey 為 true 時回傳 true
  - [ ] metaKey 為 true 時回傳 true
  - [ ] 兩者都為 false 時回傳 false

### 3.5 `tests/utils/domHelpers.test.ts`

目標：`src/utils/domHelpers.ts` 的 `isEditingElement`, `hasTextSelection`, `getPlatformModifierKey`, `isModifierKeyPressed`

- [ ] describe `isEditingElement`
  - [ ] activeElement 為 INPUT 回傳 true
  - [ ] activeElement 為 TEXTAREA 回傳 true
  - [ ] activeElement 為 SELECT 回傳 true
  - [ ] activeElement 有 contenteditable="true" 回傳 true
  - [ ] activeElement 為 DIV（無 contenteditable）回傳 false
  - [ ] activeElement 為 null 回傳 false

- [ ] describe `hasTextSelection`
  - [ ] 有選取文字回傳 true
  - [ ] 無選取文字回傳 false
  - [ ] window.getSelection() 為 null 回傳 false

- [ ] describe `getPlatformModifierKey`
  - [ ] Mac 平台回傳 metaKey
  - [ ] 非 Mac 平台回傳 ctrlKey

- [ ] describe `isModifierKeyPressed`
  - [ ] Mac 平台檢查 metaKey
  - [ ] Windows 平台檢查 ctrlKey

### 3.6 `tests/lib/sanitize.test.ts`

目標：`src/lib/sanitize.ts` 的 `validatePodName`

- [ ] describe `validatePodName`
  - [ ] 正常名稱回傳 true
  - [ ] 空字串回傳 false
  - [ ] 純空白字串回傳 false
  - [ ] 超過 50 字元回傳 false
  - [ ] 剛好 50 字元回傳 true
  - [ ] 前後有空白但 trim 後有效，回傳 true

### 3.7 `tests/services/WebSocketClient.test.ts`

目標：`src/services/websocket/WebSocketClient.ts`

注意：需要 Mock 原生 `WebSocket` 類別

- [ ] describe `WebSocketClient`
  - [ ] describe `connect`
    - [ ] 建立 WebSocket 實例並設定事件 handler
    - [ ] dev 模式（port 5173）連到 port 3001
    - [ ] 已連線時不重複連線
  - [ ] describe `disconnect`
    - [ ] 清理 socket 並設 isConnected 為 false
    - [ ] 停止重連計時器
  - [ ] describe `emit`
    - [ ] 未連線時不發送（印出 console.error）
    - [ ] 已連線時透過 socket.send 發送 JSON 訊息
    - [ ] 訊息格式包含 type, payload, requestId
  - [ ] describe `on / off`
    - [ ] 註冊事件監聽器
    - [ ] 取消註冊事件監聽器
    - [ ] 收到訊息時觸發對應 listener
  - [ ] describe `onWithAck / offWithAck`
    - [ ] 含 ackId 的訊息觸發 callback 並傳入 ack 函數
    - [ ] 呼叫 ack 函數會透過 socket.send 回傳 ack 訊息
  - [ ] describe `handleMessage`
    - [ ] type 為 ack 時解析 ackId 並呼叫對應 callback
    - [ ] 正常訊息分發到註冊的 listener
    - [ ] JSON 解析錯誤不崩潰
  - [ ] describe `斷線重連`
    - [ ] handleClose 觸發 disconnect listener
    - [ ] handleClose 啟動重連計時器（每 3 秒）
    - [ ] 重連成功後停止計時器

### 3.8 `tests/services/createWebSocketRequest.test.ts`

目標：`src/services/websocket/createWebSocketRequest.ts`

注意：需要 Mock `websocketClient` 和 `generateRequestId`

- [ ] describe `createWebSocketRequest`
  - [ ] 成功流程：emit 請求事件、監聽回應事件、requestId 匹配、resolve Promise
  - [ ] 失敗流程：回應 success: false 時 reject Error
  - [ ] 超時流程：超過 timeout 時間 reject Error 並取消監聯器
  - [ ] 未連線時立即 reject
  - [ ] 自訂 matchResponse 函數驗證
  - [ ] 不匹配的 requestId 不觸發 resolve

---

## 4. Phase 2：Core Stores 測試

### 4.1 `tests/stores/canvasStore.test.ts`

目標：`src/stores/canvasStore.ts`

前置：Mock WebSocket，使用 `setupTestPinia()`

覆蓋 User Flow：Flow 1.1

- [ ] describe `canvasStore`
  - [ ] describe `初始狀態`
    - [ ] canvases 為空陣列
    - [ ] activeCanvasId 為 null
    - [ ] isSidebarOpen 為 false
    - [ ] isLoading 為 false

  - [ ] describe `getters`
    - [ ] `activeCanvas` - 有 activeCanvasId 時回傳對應 Canvas
    - [ ] `activeCanvas` - 無 activeCanvasId 時回傳 null
    - [ ] `activeCanvas` - activeCanvasId 不存在於 canvases 中時回傳 null

  - [ ] describe `toggleSidebar`
    - [ ] 切換 isSidebarOpen 狀態

  - [ ] describe `createCanvas` (Flow 1.1 步驟 1)
    - [ ] 成功：呼叫 WebSocket 建立、切換到新 Canvas、顯示成功 Toast、回傳 Canvas 物件
    - [ ] 成功後 activeCanvasId 更新為新 Canvas ID
    - [ ] 失敗：WebSocket 回傳錯誤、顯示失敗 Toast、回傳 null
    - [ ] 驗證 WebSocket 發送的 payload 包含 name

  - [ ] describe `loadCanvases`
    - [ ] 成功：設定 canvases 陣列（按 sortIndex 排序）
    - [ ] 有 canvases 且無 activeCanvasId 時自動切換到第一個
    - [ ] isLoading 正確切換（true -> false）
    - [ ] 失敗時 throw error 且 isLoading 恢復為 false

  - [ ] describe `deleteCanvas`
    - [ ] 刪除非活躍 Canvas：僅發送 WebSocket 請求
    - [ ] 刪除活躍 Canvas：先切換到其他 Canvas 再刪除

  - [ ] describe `switchCanvas`
    - [ ] 成功：更新 activeCanvasId
    - [ ] 目標與當前相同時不發送請求

  - [ ] describe `renameCanvas`
    - [ ] 成功：顯示成功 Toast
    - [ ] 失敗：顯示失敗 Toast

  - [ ] describe `事件處理 (FromEvent)`
    - [ ] `addCanvasFromEvent` - 新增不重複的 Canvas
    - [ ] `addCanvasFromEvent` - 已存在的 Canvas 不重複新增
    - [ ] `renameCanvasFromEvent` - 更新指定 Canvas 的名稱
    - [ ] `removeCanvasFromEvent` - 移除 Canvas 並自動切換活躍 Canvas
    - [ ] `removeCanvasFromEvent` - 最後一個被刪除時建立預設 Canvas
    - [ ] `reorderCanvasesFromEvent` - 按指定順序重排

  - [ ] describe `reorderCanvases`
    - [ ] 本地陣列重排正確
    - [ ] 同步到後端成功
    - [ ] 同步失敗時 rollback 到原始順序

  - [ ] describe `reset`
    - [ ] 所有狀態回到初始值

### 4.2 `tests/stores/podStore.test.ts`

目標：`src/stores/pod/podStore.ts`

前置：Mock WebSocket，使用 `setupStoreWithCanvas()`

覆蓋 User Flow：Flow 1.2, 1.3, 1.8

- [ ] describe `podStore`
  - [ ] describe `初始狀態`
    - [ ] selectedPodId 為 null
    - [ ] activePodId 為 null
    - [ ] typeMenu.visible 為 false
    - [ ] scheduleFiredPodIds 為空 Set

  - [ ] describe `getters`
    - [ ] `selectedPod` - 依 selectedPodId 回傳 Pod
    - [ ] `selectedPod` - 無選取時回傳 null
    - [ ] `podCount` - 回傳 pods 長度
    - [ ] `getPodById` - 找到回傳 Pod
    - [ ] `getPodById` - 找不到回傳 undefined
    - [ ] `isScheduleFiredAnimating` - 在 Set 中回傳 true

  - [ ] describe `isValidPod`
    - [ ] 所有欄位合法時回傳 true
    - [ ] 名稱無效（空字串、超長）回傳 false
    - [ ] 顏色不在合法清單中回傳 false
    - [ ] id 為空字串回傳 false
    - [ ] x/y/rotation 為 NaN 或 Infinity 回傳 false
    - [ ] output 非陣列回傳 false
    - [ ] output 含非字串元素回傳 false

  - [ ] describe `enrichPod`
    - [ ] 缺少的欄位填入預設值（x: 100, y: 150, model: 'opus', autoClear: false 等）
    - [ ] 已有的欄位保留原值
    - [ ] rotation 缺少時生成 -1 到 1 之間的隨機值

  - [ ] describe `addPod`
    - [ ] 合法 Pod 新增到陣列
    - [ ] 不合法 Pod 不新增

  - [ ] describe `updatePod`
    - [ ] Pod 存在時更新（驗證 splice 行為）
    - [ ] 保留 existing output（當新 pod 的 output 為 undefined）
    - [ ] 驗證失敗時不更新

  - [ ] describe `createPodWithBackend` (Flow 1.2 步驟 1)
    - [ ] 成功：WebSocket 建立 Pod、顯示成功 Toast、回傳 Pod 物件
    - [ ] 回傳的 Pod 包含本地座標（而非後端座標）
    - [ ] 無 activeCanvasId 時 throw Error
    - [ ] 失敗：顯示失敗 Toast 並 throw Error
    - [ ] 驗證 WebSocket payload 包含 canvasId, name, color, x, y, rotation

  - [ ] describe `deletePodWithBackend`
    - [ ] 成功：發送 WebSocket 請求、顯示成功 Toast
    - [ ] 失敗：顯示失敗 Toast 並 throw Error

  - [ ] describe `movePod`
    - [ ] 更新 Pod 座標
    - [ ] 座標限制在 -100000 到 100000 範圍
    - [ ] NaN 座標不更新（保留原值）
    - [ ] Pod 不存在時不做任何事

  - [ ] describe `syncPodPosition`
    - [ ] emit WebSocket 事件包含 podId, x, y

  - [ ] describe `renamePodWithBackend`
    - [ ] 成功：顯示成功 Toast
    - [ ] 無 activeCanvasId 時 throw Error

  - [ ] describe `selectPod / setActivePod`
    - [ ] 正確設定 selectedPodId / activePodId
    - [ ] 設為 null 清除選取

  - [ ] describe `updatePodModel` (Flow 1.3)
    - [ ] 更新指定 Pod 的 model 欄位
    - [ ] Pod 不存在時不做任何事

  - [ ] describe `setScheduleWithBackend` (Flow 1.8 步驟 1)
    - [ ] 成功：WebSocket 請求、顯示「更新成功」Toast、回傳 Pod
    - [ ] schedule 為 null 時顯示「清除成功」Toast
    - [ ] 無 activeCanvasId 時 throw Error

  - [ ] describe `triggerScheduleFiredAnimation / clearScheduleFiredAnimation` (Flow 1.8 步驟 2)
    - [ ] 新增 podId 到 scheduleFiredPodIds
    - [ ] 清除 podId 從 scheduleFiredPodIds
    - [ ] 重複新增同一 podId 不會有多份

  - [ ] describe `事件處理`
    - [ ] `addPodFromEvent` - enrich 後新增（驗證通過才加入）
    - [ ] `removePod` - 移除 Pod、清除 selectedPodId/activePodId、刪除相關 Connection
    - [ ] `updatePodPosition` - 更新座標
    - [ ] `updatePodName` - 更新名稱
    - [ ] `updatePodOutputStyle` - 設定/清除 outputStyleId
    - [ ] `updatePodRepository` - 設定/清除 repositoryId
    - [ ] `updatePodCommand` - 設定/清除 commandId
    - [ ] `clearPodOutputsByIds` - 清空指定 Pod 的 output 陣列

  - [ ] describe `setAutoClearWithBackend`
    - [ ] 成功：回傳 Pod、顯示 Toast
    - [ ] 失敗：回傳 null

  - [ ] describe `syncPodsFromBackend`
    - [ ] 處理多個 Pod（enrichPod + 驗證過濾）
    - [ ] 無效 Pod 被過濾掉

  - [ ] describe `showTypeMenu / hideTypeMenu`
    - [ ] 顯示/隱藏 typeMenu

### 4.3 `tests/stores/connectionStore.test.ts`

目標：`src/stores/connectionStore.ts`

前置：Mock WebSocket，使用 `setupStoreWithPods()`（需要 Pod 資料來建立 Connection）

覆蓋 User Flow：Flow 1.5, 1.6, 1.7

- [ ] describe `connectionStore`
  - [ ] describe `初始狀態`
    - [ ] connections 為空陣列
    - [ ] selectedConnectionId 為 null
    - [ ] draggingConnection 為 null

  - [ ] describe `getters`
    - [ ] `getConnectionsByPodId` - 回傳包含該 Pod 的所有 Connection（source 或 target）
    - [ ] `getOutgoingConnections` - 僅回傳 sourcePodId 匹配的 Connection
    - [ ] `getConnectionsByTargetPodId` - 僅回傳 targetPodId 匹配的 Connection
    - [ ] `selectedConnection` - 依 selectedConnectionId 回傳
    - [ ] `isSourcePod` - 無 incoming Connection 時為 true
    - [ ] `hasUpstreamConnections` - 有 incoming Connection 時為 true
    - [ ] `getAiDecideConnections` - 僅回傳 triggerMode 為 ai-decide 的
    - [ ] `getDirectConnections` - 僅回傳 triggerMode 為 direct 的
    - [ ] `getAiDecideConnectionsBySourcePodId` - 篩選 sourcePodId + ai-decide
    - [ ] `getDirectConnectionsBySourcePodId` - 篩選 sourcePodId + direct

  - [ ] describe `createConnection` (Flow 1.5 步驟 1)
    - [ ] 成功：WebSocket 建立、回傳 Connection 物件
    - [ ] 回傳 Connection 的 createdAt 為 Date 物件
    - [ ] 預設 triggerMode 為 auto
    - [ ] 自我連接（sourcePodId === targetPodId）回傳 null
    - [ ] 重複連接（相同 source 和 target）回傳 null 並顯示 Toast
    - [ ] sourcePodId 為 null/undefined 時仍可建立（外部連線）
    - [ ] 無 activeCanvasId 時 throw Error

  - [ ] describe `deleteConnection`
    - [ ] 發送 WebSocket 請求

  - [ ] describe `deleteConnectionsByPodId`
    - [ ] 移除所有包含該 podId 的 Connection
    - [ ] 如移除的包含 selectedConnectionId，清除選取

  - [ ] describe `updateConnectionTriggerMode` (Flow 1.6)
    - [ ] 成功：回傳更新後的 Connection
    - [ ] 無 activeCanvasId 時 throw Error

  - [ ] describe `拖曳連線`
    - [ ] `startDragging` 設定 draggingConnection
    - [ ] `updateDraggingPosition` 更新 currentPoint
    - [ ] `endDragging` 清除 draggingConnection

  - [ ] describe `工作流處理` (Flow 1.7)
    - [ ] describe `handleWorkflowAutoTriggered` (步驟 1)
      - [ ] 將 targetPodId 的 auto/ai-decide Connection 狀態設為 active
      - [ ] 不覆蓋已 ai-approved 的 Connection
    - [ ] describe `handleWorkflowComplete` (步驟 4)
      - [ ] auto/ai-decide：所有 targetPodId 的 Connection 回到 idle
      - [ ] direct：僅指定 connectionId 的 Connection 回到 idle
    - [ ] describe `handleWorkflowDirectTriggered` (步驟 3)
      - [ ] 指定 connectionId 的 Connection 設為 active
    - [ ] describe `handleWorkflowDirectWaiting`
      - [ ] 指定 connectionId 的 Connection 設為 waiting
    - [ ] describe `handleAiDecidePending` (步驟 2)
      - [ ] 批量設定 connectionIds 為 ai-deciding
      - [ ] 清除 decideReason
    - [ ] describe `handleAiDecideResult` (步驟 2)
      - [ ] shouldTrigger: true -> ai-approved，清除 decideReason
      - [ ] shouldTrigger: false -> ai-rejected，設定 decideReason
    - [ ] describe `handleAiDecideError`
      - [ ] 設為 ai-error，設定 decideReason 為 error 訊息
    - [ ] describe `handleAiDecideClear`
      - [ ] 批量設定 connectionIds 為 idle，清除 decideReason
    - [ ] describe `handleWorkflowQueued` (步驟 5)
      - [ ] auto/ai-decide：設定 targetPodId 的 Connection 為 queued
      - [ ] direct：設定指定 connectionId 為 queued
    - [ ] describe `handleWorkflowQueueProcessed` (步驟 6)
      - [ ] auto/ai-decide：設定 targetPodId 的 Connection 為 active
      - [ ] direct：設定指定 connectionId 為 active

  - [ ] describe `updateConnectionStatusByTargetPod`
    - [ ] 更新所有 targetPodId 匹配的 Connection 狀態
    - [ ] 跳過 ai-approved 的 Connection（不設為 active）
    - [ ] queued -> active 允許更新

  - [ ] describe `mapDecideStatusToConnectionStatus`
    - [ ] none/undefined -> idle
    - [ ] pending -> ai-deciding
    - [ ] approved -> ai-approved
    - [ ] rejected -> ai-rejected
    - [ ] error -> ai-error

  - [ ] describe `事件處理 (FromEvent)`
    - [ ] `addConnectionFromEvent` - 新增不重複的 Connection（createdAt 轉 Date）
    - [ ] `updateConnectionFromEvent` - 更新既有 Connection
    - [ ] `removeConnectionFromEvent` - 移除 Connection

  - [ ] describe `loadConnectionsFromBackend`
    - [ ] 成功：設定 connections 陣列，triggerMode 預設 auto，status 從 decideStatus 映射
    - [ ] 無 activeCanvasId 時不載入

### 4.4 `tests/stores/selectionStore.test.ts`

目標：`src/stores/pod/selectionStore.ts`

前置：使用 `setupTestPinia()`

覆蓋 User Flow：Flow 3.1

- [ ] describe `selectionStore`
  - [ ] describe `初始狀態`
    - [ ] isSelecting 為 false
    - [ ] box 為 null
    - [ ] selectedElements 為空陣列
    - [ ] boxSelectJustEnded 為 false
    - [ ] isCtrlMode 為 false

  - [ ] describe `getters`
    - [ ] `selectedPodIds` - 篩選 type 為 pod
    - [ ] `selectedOutputStyleNoteIds` - 篩選 type 為 outputStyleNote
    - [ ] `selectedSkillNoteIds` - 篩選 type 為 skillNote
    - [ ] `selectedRepositoryNoteIds` - 篩選 type 為 repositoryNote
    - [ ] `selectedSubAgentNoteIds` - 篩選 type 為 subAgentNote
    - [ ] `selectedCommandNoteIds` - 篩選 type 為 commandNote
    - [ ] `hasSelection` - 有元素時為 true
    - [ ] `isElementSelected` - 依 type + id 判斷

  - [ ] describe `startSelection` (Flow 3.1 步驟 1)
    - [ ] isSelecting 設為 true
    - [ ] box 設定初始座標（startX, startY 同時為 endX, endY）
    - [ ] 非 Ctrl 模式：清空 selectedElements
    - [ ] Ctrl 模式：保留既有 selectedElements 到 initialSelectedElements

  - [ ] describe `updateSelection` (Flow 3.1 步驟 2)
    - [ ] 更新 box 的 endX, endY
    - [ ] box 為 null 時不做任何事

  - [ ] describe `calculateSelectedElements` (Flow 3.1 步驟 3)
    - [ ] Pod 與框選範圍相交時選中（基於 POD_WIDTH=224, POD_HEIGHT=168）
    - [ ] Note 與框選範圍相交時選中（基於 NOTE_WIDTH=80, NOTE_HEIGHT=30）
    - [ ] 已綁定的 Note（boundToPodId !== null）不被選中
    - [ ] 支援所有 5 種 Note 類型
    - [ ] Ctrl 模式：與 initialSelectedElements 做 toggle（已選取的反選，未選取的加入）
    - [ ] 非 Ctrl 模式：僅保留框選範圍內的元素
    - [ ] 框選範圍處理 startX > endX 的情況（取 min/max）

  - [ ] describe `endSelection` (Flow 3.1 步驟 4)
    - [ ] isSelecting 設為 false
    - [ ] box 清為 null
    - [ ] boxSelectJustEnded 設為 true（requestAnimationFrame 後重置為 false）
    - [ ] isCtrlMode 重置
    - [ ] initialSelectedElements 清空

  - [ ] describe `cancelSelection`
    - [ ] 不設定 boxSelectJustEnded（與 endSelection 不同）

  - [ ] describe `clearSelection`
    - [ ] 清除所有選取狀態

  - [ ] describe `toggleElement`
    - [ ] 已選取的元素：移除
    - [ ] 未選取的元素：加入

  - [ ] describe `setSelectedElements`
    - [ ] 直接設定整個 selectedElements 陣列

### 4.5 `tests/stores/viewportStore.test.ts`

目標：`src/stores/pod/viewportStore.ts`

前置：使用 `setupTestPinia()`

- [ ] describe `viewportStore`
  - [ ] describe `初始狀態`
    - [ ] offset 為 {x: 0, y: 0}
    - [ ] zoom 為 1

  - [ ] describe `screenToCanvas`
    - [ ] zoom 為 1、offset 為 0 時，螢幕座標等於畫布座標
    - [ ] 有 offset 時正確轉換
    - [ ] zoom 為 2 時正確縮放轉換

  - [ ] describe `setOffset`
    - [ ] 設定 offset x, y

  - [ ] describe `zoomTo`
    - [ ] 以指定點為中心縮放
    - [ ] 限制在 MIN_ZOOM(0.1) 到 MAX_ZOOM(3) 之間
    - [ ] zoom 大於 3 時限制為 3
    - [ ] zoom 小於 0.1 時限制為 0.1
    - [ ] 正確計算縮放後的 offset

  - [ ] describe `resetToCenter`
    - [ ] offset 設為視窗中心
    - [ ] zoom 設為 0.75

### 4.6 `tests/stores/clipboardStore.test.ts`

目標：`src/stores/clipboardStore.ts`

前置：使用 `setupTestPinia()`

- [ ] describe `clipboardStore`
  - [ ] describe `初始狀態`
    - [ ] 所有 copied 陣列為空
    - [ ] copyTimestamp 為 null

  - [ ] describe `isEmpty getter`
    - [ ] 全空時為 true
    - [ ] 有任一 copiedPods 時為 false
    - [ ] 有任一 copiedSkillNotes 時為 false（測試每種 Note 類型）

  - [ ] describe `setCopy`
    - [ ] 設定所有 7 個陣列
    - [ ] 設定 copyTimestamp 為當前時間

  - [ ] describe `clear`
    - [ ] 清空所有陣列和 timestamp

  - [ ] describe `getCopiedData`
    - [ ] 回傳所有 7 個陣列的資料

---

## 5. Phase 3：Note Stores 測試

### 5.1 `tests/stores/note/createNoteStore.test.ts`

目標：`src/stores/note/createNoteStore.ts` 工廠函數產生的 Store

前置：用簡化的 config 建立測試用 Store、Mock WebSocket

- [ ] describe `createNoteStore 工廠`
  - [ ] describe `初始狀態`
    - [ ] availableItems 為空陣列
    - [ ] notes 為空陣列
    - [ ] isLoading 為 false
    - [ ] error 為 null
    - [ ] groups 為空陣列

  - [ ] describe `getters`
    - [ ] `typedAvailableItems` - 返回型別化的 availableItems
    - [ ] `typedNotes` - 返回型別化的 notes
    - [ ] `getUnboundNotes` - 篩選 boundToPodId 為 null 的 Note
    - [ ] `getNotesByPodId` - one-to-one 模式僅回傳一個
    - [ ] `getNotesByPodId` - one-to-many 模式回傳多個
    - [ ] `getNoteById` - 依 id 找到 Note
    - [ ] `isNoteAnimating` - 在 animatingNoteIds Set 中
    - [ ] `canDeleteDraggedNote` - 有 draggedNoteId 且未綁定時為 true
    - [ ] `isItemInUse` - item 有綁定到 Pod 的 Note 時為 true
    - [ ] `isItemBoundToPod` - item 綁定到指定 Pod 時為 true
    - [ ] `getSortedItemsWithGroups` - groups 和 rootItems 分別排序

  - [ ] describe `loadItems`
    - [ ] 成功：isLoading 切換、availableItems 設定
    - [ ] 無 activeCanvasId 時不載入
    - [ ] 失敗：設定 error

  - [ ] describe `loadNotesFromBackend`
    - [ ] 成功：notes 設定
    - [ ] 失敗：設定 error

  - [ ] describe `createNote`
    - [ ] 發送 WebSocket 請求，包含 canvasId, itemId 對應欄位, x, y 等
    - [ ] item 不存在時不發送
    - [ ] 無 activeCanvasId 時 throw Error

  - [ ] describe `updateNotePosition`
    - [ ] 成功：更新 note 座標
    - [ ] 失敗：rollback 到原始座標

  - [ ] describe `updateNotePositionLocal`
    - [ ] 直接更新本地 note 座標，不發 WebSocket

  - [ ] describe `bindToPod` (Flow 1.4)
    - [ ] one-to-one：如 Pod 已有綁定，先 unbind
    - [ ] 發送 bind 和 update 兩個 WebSocket 請求（並行）
    - [ ] 無 bindEvents config 時不操作

  - [ ] describe `unbindFromPod`
    - [ ] 僅 one-to-one 且有 unbindEvents 時操作
    - [ ] returnToOriginal: true 使用 originalPosition
    - [ ] 提供 targetPosition 時使用 targetPosition

  - [ ] describe `deleteNote`
    - [ ] 發送 WebSocket 請求

  - [ ] describe `deleteItem`
    - [ ] 成功：從 availableItems 移除、刪除相關 notes、顯示成功 Toast
    - [ ] 失敗：顯示失敗 Toast 並 throw Error

  - [ ] describe `事件處理 (FromEvent)`
    - [ ] `addNoteFromEvent` - 不重複新增
    - [ ] `updateNoteFromEvent` - 替換既有 Note
    - [ ] `removeNoteFromEvent` - 移除 Note
    - [ ] `addItemFromEvent` - 不重複新增
    - [ ] `removeItemFromEvent` - 移除 item 及相關 notes
    - [ ] `addGroupFromEvent` / `updateGroupFromEvent` / `removeGroupFromEvent`

  - [ ] describe `拖曳狀態`
    - [ ] `setDraggedNote` - 設定/清除 draggedNoteId
    - [ ] `setNoteAnimating` - 新增/移除 animatingNoteIds
    - [ ] `setIsDraggingNote` / `setIsOverTrash`

  - [ ] describe `群組展開`
    - [ ] `toggleGroupExpand` - 展開/收起 toggle
    - [ ] `updateItemGroupId` - 更新 item 的 groupId

### 5.2 `tests/stores/note/outputStyleStore.test.ts`

目標：`src/stores/note/outputStyleStore.ts` 的自訂 actions

前置：Mock WebSocket，使用 `setupStoreWithCanvas()`

- [ ] describe `outputStyleStore 自訂 actions`
  - [ ] describe `createOutputStyle`
    - [ ] 成功：新增到 availableItems、顯示成功 Toast
    - [ ] 失敗：回傳 error
  - [ ] describe `updateOutputStyle`
    - [ ] 成功：更新 availableItems 中的 item、顯示成功 Toast
    - [ ] 失敗：回傳 error
  - [ ] describe `readOutputStyle`
    - [ ] 回傳含 content 的物件
    - [ ] 失敗回傳 null
  - [ ] describe `deleteOutputStyle`
    - [ ] 委派到 deleteItem
  - [ ] describe `rebuildNotesFromPods`
    - [ ] 為每個有 outputStyleId 的 Pod 建立 Note
    - [ ] 已有 Note 的 Pod 跳過
    - [ ] 無 activeCanvasId 時不操作
  - [ ] describe `群組操作`
    - [ ] loadOutputStyleGroups - 載入並設定 groups
    - [ ] createOutputStyleGroup - 建立並加入 groups
    - [ ] updateOutputStyleGroup - 更新 groups
    - [ ] deleteOutputStyleGroup - 刪除 groups
    - [ ] moveOutputStyleToGroup - 更新 item 的 groupId

### 5.3 `tests/stores/note/skillStore.test.ts`

目標：`src/stores/note/skillStore.ts` 的自訂 actions

- [ ] describe `skillStore 自訂 actions`
  - [ ] describe `deleteSkill` - 委派到 deleteItem
  - [ ] describe `loadSkills` - 委派到 loadItems
  - [ ] describe `importSkill`
    - [ ] 成功：回傳 skill 物件、isOverwrite 旗標
    - [ ] 成功後重新載入 skills（呼叫 loadSkills）
    - [ ] 失敗：回傳 error

### 5.4 `tests/stores/note/repositoryStore.test.ts`

目標：`src/stores/note/repositoryStore.ts` 的自訂 actions

- [ ] describe `repositoryStore 自訂 actions`
  - [ ] describe `createRepository` - 成功新增到 availableItems / 失敗回傳 error
  - [ ] describe `deleteRepository` - 委派到 deleteItem
  - [ ] describe `loadRepositories` - 委派到 loadItems
  - [ ] describe `checkIsGit` - 更新 repository.isGit 欄位
  - [ ] describe `createWorktree` - 成功時新增 repository 並建立 Note
  - [ ] describe `getLocalBranches` - 回傳 branches, currentBranch, worktreeBranches
  - [ ] describe `checkDirty` - 回傳 isDirty
  - [ ] describe `checkoutBranch` - 成功時更新 currentBranch、顯示對應 action Toast
  - [ ] describe `deleteBranch` - 成功/失敗 Toast
  - [ ] describe `isWorktree` - 有 parentRepoId 時回傳 true

### 5.5 `tests/stores/note/subAgentStore.test.ts`

目標：`src/stores/note/subAgentStore.ts` 的自訂 actions

- [ ] describe `subAgentStore 自訂 actions`
  - [ ] describe `createSubAgent` - 成功/失敗
  - [ ] describe `updateSubAgent` - 成功/失敗
  - [ ] describe `readSubAgent` - 成功/失敗
  - [ ] describe `deleteSubAgent` - 委派到 deleteItem
  - [ ] describe `loadSubAgents` - 委派到 loadItems
  - [ ] describe `群組操作` - loadSubAgentGroups, createSubAgentGroup, updateSubAgentGroup, deleteSubAgentGroup, moveSubAgentToGroup

### 5.6 `tests/stores/note/commandStore.test.ts`

目標：`src/stores/note/commandStore.ts` 的自訂 actions

- [ ] describe `commandStore 自訂 actions`
  - [ ] describe `createCommand` - 成功/失敗
  - [ ] describe `updateCommand` - 成功/失敗
  - [ ] describe `readCommand` - 成功/失敗
  - [ ] describe `deleteCommand` - 委派到 deleteItem
  - [ ] describe `loadCommands` - 委派到 loadItems
  - [ ] describe `rebuildNotesFromPods`
    - [ ] 為每個有 commandId 的 Pod 建立 Note
    - [ ] 已有 Note 的 Pod 跳過
  - [ ] describe `群組操作` - 6 個群組方法

### 5.7 `tests/stores/note/createResourceCRUDActions.test.ts`

目標：`src/stores/note/createResourceCRUDActions.ts`

- [ ] describe `createResourceCRUDActions`
  - [ ] describe `create`
    - [ ] 成功：新增到 items 陣列、顯示成功 Toast
    - [ ] 失敗（WebSocket 錯誤）：顯示失敗 Toast、回傳 error
    - [ ] 失敗（response 無 item）：回傳 error
  - [ ] describe `update`
    - [ ] 成功：更新 items 陣列中的 item、顯示成功 Toast
    - [ ] 失敗：回傳 error
  - [ ] describe `read`
    - [ ] 成功：回傳 item
    - [ ] 失敗：回傳 null

---

## 6. Phase 4：Chat Store 測試

### 6.1 `tests/stores/chat/chatStore.test.ts`

目標：`src/stores/chat/chatStore.ts`

前置：Mock WebSocket，使用 `setupStoreWithPods()`

覆蓋 User Flow：Flow 2.1, 2.2, 2.7

- [ ] describe `chatStore`
  - [ ] describe `初始狀態`
    - [ ] messagesByPodId 為空 Map
    - [ ] isTypingByPodId 為空 Map
    - [ ] currentStreamingMessageId 為 null
    - [ ] connectionStatus 為 disconnected
    - [ ] allHistoryLoaded 為 false
    - [ ] autoClearAnimationPodId 為 null

  - [ ] describe `getters`
    - [ ] `getMessages` - 回傳指定 podId 的訊息陣列，不存在時回傳空陣列
    - [ ] `isTyping` - 回傳指定 podId 的打字狀態
    - [ ] `isConnected` - connectionStatus 為 connected 時為 true
    - [ ] `getHistoryLoadingStatus` - 預設回傳 idle
    - [ ] `isHistoryLoading` - loading 狀態時為 true
    - [ ] `isAllHistoryLoaded`
    - [ ] `getDisconnectReason`

  - [ ] describe `sendMessage` (Flow 2.2)
    - [ ] 成功：emit WebSocket 事件、設定 isTyping 為 true
    - [ ] 包含 Command 時前綴 `/{commandName}`
    - [ ] 含 contentBlocks 時組裝 blocks 格式
    - [ ] 空白訊息不發送
    - [ ] 未連線時 throw Error

  - [ ] describe `abortChat` (Flow 2.7)
    - [ ] 已連線：emit POD_CHAT_ABORT 事件
    - [ ] 未連線：不發送

  - [ ] describe `clearMessagesByPodIds`
    - [ ] 清除指定 podIds 的 messages 和 typing 狀態
    - [ ] 同時清除 historyLoadingStatus 和 historyLoadingError

  - [ ] describe `clearAutoClearAnimation`
    - [ ] 清除 autoClearAnimationPodId

  - [ ] describe `registerListeners / unregisterListeners`
    - [ ] 驗證所有事件 listener 的註冊和取消

### 6.2 `tests/stores/chat/chatMessageActions.test.ts`

目標：`src/stores/chat/chatMessageActions.ts`

前置：Mock WebSocket，使用 `setupStoreWithPods()`，透過 `useChatStore().getMessageActions()` 取得 actions

覆蓋 User Flow：Flow 2.2, 2.3, 2.4, 2.5

- [ ] describe `chatMessageActions`
  - [ ] describe `addUserMessage` (Flow 2.2)
    - [ ] 新增 user 訊息到 messagesByPodId
    - [ ] 更新 Pod 的 output（含截斷的內容預覽）

  - [ ] describe `handleChatMessage - 新訊息` (Flow 2.3 步驟 1)
    - [ ] 訊息不存在時建立新 assistant 訊息
    - [ ] 設定 currentStreamingMessageId
    - [ ] isPartial 為 true 時設定 isTyping
    - [ ] 建立初始 subMessage
    - [ ] 設定 expectingNewBlock 為 true
    - [ ] 記錄 accumulatedLengthByMessageId

  - [ ] describe `handleChatMessage - 更新訊息` (Flow 2.3 步驟 2)
    - [ ] 更新既有訊息的 content
    - [ ] 計算 delta（content 增量）
    - [ ] 更新 subMessage 的 content
    - [ ] expectingNewBlock 為 true 時建立新 subMessage

  - [ ] describe `handleChatMessage - user role 訊息`
    - [ ] role 為 user 時更新 Pod output
    - [ ] 避免重複追加相同內容

  - [ ] describe `handleChatToolUse` (Flow 2.4 步驟 1)
    - [ ] 訊息不存在時建立含 toolUse 的新訊息
    - [ ] 訊息存在時新增 toolUse 到陣列
    - [ ] 重複的 toolUseId 不新增
    - [ ] 設定 expectingNewBlock 為 true
    - [ ] 同時更新 subMessage 的 toolUse

  - [ ] describe `handleChatToolResult` (Flow 2.4 步驟 2)
    - [ ] 更新 toolUse 的 output 和 status
    - [ ] 訊息或 toolUseId 不存在時不做任何事
    - [ ] 同時更新 subMessage 的 toolUse
    - [ ] 所有 tool 完成後 subMessage 的 isPartial 設為 false

  - [ ] describe `handleChatComplete` (Flow 2.3 步驟 3, Flow 2.5)
    - [ ] 設定 isPartial 為 false
    - [ ] 設定 isTyping 為 false
    - [ ] 清除 currentStreamingMessageId
    - [ ] 清除 accumulatedLengthByMessageId 中的記錄
    - [ ] 更新 Pod output（assistant 訊息）
    - [ ] finalize 所有 running 的 toolUse 為 completed
    - [ ] finalize 所有 subMessage 的 isPartial
    - [ ] 訊息不存在時僅 finalizeStreaming

  - [ ] describe `handleChatAborted` (Flow 2.7)
    - [ ] 訊息存在：完成現有訊息（保留部分內容）
    - [ ] 訊息不存在：僅 finalizeStreaming
    - [ ] 設定 isTyping 為 false
    - [ ] 清除 accumulatedLengthByMessageId

  - [ ] describe `handleMessagesClearedEvent` (Flow 2.5 AutoClear)
    - [ ] 清除指定 podId 的訊息
    - [ ] 清除 Pod 的 output

  - [ ] describe `handleWorkflowAutoCleared`
    - [ ] 批量清除 clearedPodIds 的訊息
    - [ ] 設定 autoClearAnimationPodId

  - [ ] describe `convertPersistedToMessage`
    - [ ] user 訊息轉換（無 subMessages）
    - [ ] assistant 訊息轉換（含 subMessages、toolUse）
    - [ ] assistant 無 subMessages 時建立預設 subMessage

  - [ ] describe `setTyping`
    - [ ] 設定 isTypingByPodId

  - [ ] describe `clearMessagesByPodIds`
    - [ ] 清除多個 podId 的 messages 和 typing

### 6.3 `tests/stores/chat/chatConnectionActions.test.ts`

目標：`src/stores/chat/chatConnectionActions.ts`

前置：Mock WebSocket，使用 `setupTestPinia()`

覆蓋 User Flow：Flow 2.1

- [ ] describe `chatConnectionActions`
  - [ ] describe `initWebSocket`
    - [ ] 設定 connectionStatus 為 connecting
    - [ ] 呼叫 websocketClient.connect()

  - [ ] describe `disconnectWebSocket`
    - [ ] 呼叫 unregisterListeners
    - [ ] 呼叫 websocketClient.disconnect()
    - [ ] 設定 connectionStatus 為 disconnected
    - [ ] 清除 socketId
    - [ ] 停止心跳檢查

  - [ ] describe `handleConnectionReady`
    - [ ] 設定 connectionStatus 為 connected
    - [ ] 設定 socketId
    - [ ] 啟動心跳檢查

  - [ ] describe `handleHeartbeatPing`
    - [ ] 更新 lastHeartbeatAt
    - [ ] 呼叫 ack 回傳 timestamp
    - [ ] 非 connected 狀態時恢復為 connected

  - [ ] describe `心跳超時`
    - [ ] 超過 20 秒未收到心跳：設定 disconnected、顯示 Toast
    - [ ] lastHeartbeatAt 為 null 時不判斷超時

  - [ ] describe `handleSocketDisconnect`
    - [ ] 設定 disconnectReason
    - [ ] 設定 connectionStatus 為 disconnected
    - [ ] 重置連線狀態（socketId, historyLoadingStatus 等）
    - [ ] 顯示斷線 Toast

  - [ ] describe `handleError`
    - [ ] websocketClient 未連線時設定 connectionStatus 為 error
    - [ ] 有 podId 時設定該 pod 的 typing 為 false

### 6.4 `tests/stores/chat/chatHistoryActions.test.ts`

目標：`src/stores/chat/chatHistoryActions.ts`

前置：Mock WebSocket，使用 `setupTestPinia()`

覆蓋 User Flow：Flow 2.6

- [ ] describe `chatHistoryActions`
  - [ ] describe `loadPodChatHistory` (Flow 2.6 步驟 1)
    - [ ] 成功：設定 messages、status 為 loaded
    - [ ] loading 過程：status 為 loading
    - [ ] 已 loaded 時不重複載入
    - [ ] 正在 loading 時不重複載入
    - [ ] 未連線時設定 error 並 throw
    - [ ] WebSocket 失敗時設定 status 為 error

  - [ ] describe `loadAllPodsHistory`
    - [ ] 批量載入所有 Pod 的歷史（使用 Promise.allSettled）
    - [ ] 完成後設定 allHistoryLoaded 為 true
    - [ ] 空 podIds 時直接設定 allHistoryLoaded

---

## 7. Phase 5：Composables 測試

### 7.1 `tests/composables/useToast.test.ts`

目標：`src/composables/useToast.ts`

- [ ] describe `useToast`
  - [ ] describe `toast`
    - [ ] 新增 Toast 到 toasts 陣列
    - [ ] 自動在 duration 後移除
    - [ ] 回傳唯一的 id
    - [ ] 預設 variant 為 default
    - [ ] description 超過 200 字元截斷
  - [ ] describe `dismiss`
    - [ ] 依 id 移除指定 Toast
    - [ ] id 不存在時不報錯
  - [ ] describe `showSuccessToast`
    - [ ] title 為 category、description 為 action - target
    - [ ] 無 target 時 description 僅為 action
  - [ ] describe `showErrorToast`
    - [ ] variant 為 destructive

### 7.2 `tests/composables/useWebSocketErrorHandler.test.ts`

目標：`src/composables/useWebSocketErrorHandler.ts`

- [ ] describe `useWebSocketErrorHandler`
  - [ ] describe `handleWebSocketError`
    - [ ] 呼叫 toast 顯示錯誤（variant: destructive）
    - [ ] 使用 sanitizeErrorForUser 處理 error
    - [ ] 預設 title 為「操作失敗」
  - [ ] describe `wrapWebSocketRequest`
    - [ ] 成功：回傳 Promise 結果
    - [ ] 失敗：呼叫 handleWebSocketError、回傳 null

### 7.3 `tests/composables/useConnectionPath.test.ts`

目標：`src/composables/useConnectionPath.ts`

- [ ] describe `useConnectionPath`
  - [ ] describe `calculatePathData`
    - [ ] 回傳包含 path, midPoint, angle 的物件
    - [ ] path 為 SVG Bezier 曲線格式（M ... C ...）
    - [ ] midPoint 在起點和終點之間
    - [ ] 不同 anchor 組合（top/bottom/left/right）產生不同 control points
    - [ ] 起點和終點相同時不崩潰
  - [ ] describe `calculateMultipleArrowPositions`
    - [ ] 回傳至少 1 個箭頭位置
    - [ ] 箭頭數量隨距離增加
    - [ ] 每個箭頭包含 x, y, angle
    - [ ] 自訂 spacing 影響箭頭數量

### 7.4 `tests/composables/canvas/useBoxSelect.test.ts`

目標：`src/composables/canvas/useBoxSelect.ts`

前置：需要在 Vue component context 中測試（使用 `withSetup` helper），Mock `useCanvasContext`

注意：此 Composable 使用 `onUnmounted`，需在 component 生命週期中測試

- [ ] describe `useBoxSelect`
  - [ ] 回傳 isBoxSelecting ref 和 startBoxSelect 函數
  - [ ] 非左鍵點擊時不啟動
  - [ ] target 非 canvas-grid/canvas-content 時不啟動
  - [ ] 啟動後設定 selectionStore.startSelection
  - [ ] 拖曳距離小於閾值（5px）時呼叫 cancelSelection
  - [ ] 拖曳距離大於閾值時呼叫 endSelection
  - [ ] unmount 時清理事件監聽器

### 7.5 `tests/composables/canvas/useCanvasPan.test.ts`

目標：`src/composables/canvas/useCanvasPan.ts`

- [ ] describe `useCanvasPan`
  - [ ] 非右鍵（button !== 2）不啟動
  - [ ] target 非 canvas 相關元素不啟動
  - [ ] 啟動後 isPanning 為 true
  - [ ] 拖曳更新 viewportStore.offset
  - [ ] 拖曳距離超過 3px 時 hasPanned 為 true
  - [ ] 放開滑鼠後 isPanning 為 false
  - [ ] resetPanState 重置 hasPanned

### 7.6 `tests/composables/canvas/useCanvasZoom.test.ts`

目標：`src/composables/canvas/useCanvasZoom.ts`

- [ ] describe `useCanvasZoom`
  - [ ] 向下滾動（deltaY > 0）縮小（乘 0.9）
  - [ ] 向上滾動（deltaY < 0）放大（乘 1.1）
  - [ ] 呼叫 viewportStore.zoomTo 並傳入滑鼠位置

### 7.7 `tests/composables/canvas/useDeleteSelection.test.ts`

目標：`src/composables/canvas/useDeleteSelection.ts`

前置：Mock `useCanvasContext`

覆蓋 User Flow：Flow 3.5

- [ ] describe `useDeleteSelection`
  - [ ] describe `deleteSelectedElements`
    - [ ] 刪除所有選中的 Pod（呼叫 deletePodWithBackend）
    - [ ] 刪除所有選中的 5 種 Note（呼叫各 store 的 deleteNote）
    - [ ] 使用 Promise.allSettled（部分失敗不阻斷）
    - [ ] 完成後清除 selectionStore.clearSelection
    - [ ] 部分失敗時顯示 Toast「刪除部分失敗」
    - [ ] 無選中元素時不操作

### 7.8 `tests/composables/canvas/useBatchDrag.test.ts`

目標：`src/composables/canvas/useBatchDrag.ts`

前置：Mock `useCanvasContext`

覆蓋 User Flow：Flow 3.4

- [ ] describe `useBatchDrag`
  - [ ] describe `startBatchDrag`
    - [ ] 非左鍵不啟動，回傳 false
    - [ ] 無選取元素時不啟動，回傳 false
    - [ ] 啟動後 isBatchDragging 為 true，回傳 true

  - [ ] describe `拖曳過程`
    - [ ] 移動所有選中的 Pod（呼叫 podStore.movePod）
    - [ ] 移動所有選中的 Note（呼叫各 store 的 updateNotePositionLocal）
    - [ ] 已綁定的 Note（boundToPodId !== null）不移動
    - [ ] delta 計算考慮 viewportStore.zoom

  - [ ] describe `結束拖曳`
    - [ ] isBatchDragging 設為 false
    - [ ] 同步所有移動的 Pod（syncPodPosition）
    - [ ] 同步所有移動的 Note（updateNotePosition）
    - [ ] 清理事件監聽器

  - [ ] describe `isElementSelected`
    - [ ] 委派到 selectionStore.selectedElements 檢查

### 7.9 `tests/composables/canvas/useCopyPaste.test.ts`

目標：`src/composables/canvas/useCopyPaste.ts`

前置：Mock `useCanvasContext`，Mock `document.addEventListener`

覆蓋 User Flow：Flow 3.2, 3.3

注意：這是最複雜的 Composable（650 行），需要拆分為多個 describe 區塊

- [ ] describe `useCopyPaste`
  - [ ] describe `複製 (handleCopy)` (Flow 3.2)
    - [ ] 無選中元素時不複製，回傳 false
    - [ ] 收集選中的 Pod 資料
    - [ ] 收集選中 Pod 綁定的 Note（5 種類型）
    - [ ] 收集選中的未綁定 Note
    - [ ] 收集兩端都在選中範圍內的 Connection
    - [ ] 呼叫 clipboardStore.setCopy 儲存

  - [ ] describe `貼上 (handlePaste)` (Flow 3.3)
    - [ ] clipboard 為空時不貼上，回傳 false
    - [ ] 計算貼上位置（基於滑鼠座標轉換為畫布座標）
    - [ ] 計算 bounding box 和偏移量
    - [ ] 發送 CANVAS_PASTE WebSocket 請求
    - [ ] 成功後設定新建元素為選中狀態
    - [ ] 僅選中未綁定的 Note

  - [ ] describe `位置計算`
    - [ ] `calculateBoundingBox` - 計算所有 Pod 和未綁定 Note 的包圍框
    - [ ] `calculateOffsets` - 計算原始中心到目標位置的偏移量
    - [ ] `transformPods` - 應用偏移量到 Pod 座標
    - [ ] `transformNotes` - 未綁定 Note 應用偏移量，已綁定 Note 座標設為 0
    - [ ] `transformConnections` - 轉換 Connection 格式

  - [ ] describe `鍵盤事件`
    - [ ] Ctrl+C 觸發複製
    - [ ] Ctrl+V 觸發貼上
    - [ ] 在編輯元素中（input/textarea）不觸發
    - [ ] 有文字選取時 Ctrl+C 不觸發（讓瀏覽器處理）
    - [ ] 非 Ctrl/Cmd 鍵不觸發

### 7.10 `tests/composables/pod/useSlotDropTarget.test.ts`

目標：`src/composables/pod/useSlotDropTarget.ts`

前置：需在 Vue component context 中測試

- [ ] describe `useSlotDropTarget`
  - [ ] draggedNoteId 有值時設定事件監聯器
  - [ ] draggedNoteId 變為 null 時清理監聽器
  - [ ] 滑鼠在 slot 範圍內時 isDropTarget 為 true
  - [ ] 滑鼠在 slot 範圍外時 isDropTarget 為 false
  - [ ] mouseup 且 isDropTarget 為 true 時觸發 onDrop
  - [ ] validateDrop 回傳 false 時不觸發 onDrop
  - [ ] drop 後 isInserting 為 true，300ms 後恢復

### 7.11 `tests/composables/pod/useSlotEject.test.ts`

目標：`src/composables/pod/useSlotEject.ts`

前置：需在 Vue component context 中測試

- [ ] describe `useSlotEject`
  - [ ] 正在 ejecting 時不重複觸發
  - [ ] 計算彈出位置（考慮 Pod 旋轉角度）
  - [ ] 呼叫 setNoteAnimating 和 unbindFromPod
  - [ ] 完成後呼叫 onRemoved callback
  - [ ] 300ms 後重置 isEjecting 和 animating

---

## 8. Phase 6：整合測試

### 8.1 `tests/integration/canvasPodFlow.test.ts`

覆蓋 User Flow：Flow 1 完整流程

- [ ] describe `Canvas/Pod 操作完整流程`
  - [ ] describe `建立 Canvas 並新增 Pod`
    - [ ] 建立 Canvas -> 建立 Pod -> Pod 加入到正確的 Canvas
    - [ ] 驗證跨 Store 狀態一致性（canvasStore.activeCanvasId, podStore.pods）

  - [ ] describe `Pod 設定與 Note 綁定`
    - [ ] 建立 Pod -> 設定 Model -> 綁定 OutputStyle Note
    - [ ] 驗證 Pod 的 outputStyleId 更新
    - [ ] 驗證 Note 的 boundToPodId 更新

  - [ ] describe `建立連接並觸發工作流`
    - [ ] 建立 2 個 Pod -> 建立 Connection -> 模擬 Auto Trigger
    - [ ] 驗證 Connection 狀態從 idle -> active -> idle
    - [ ] 驗證 AI Decide 流程：idle -> ai-deciding -> ai-approved/ai-rejected

  - [ ] describe `排程觸發`
    - [ ] 設定排程 -> 模擬 SCHEDULE_FIRED 事件 -> 驗證動畫狀態

### 8.2 `tests/integration/chatFlow.test.ts`

覆蓋 User Flow：Flow 2 完整流程

- [ ] describe `Chat 對話完整流程`
  - [ ] describe `發送訊息到串流接收`
    - [ ] sendMessage -> handleChatMessage（多次 delta）-> handleChatComplete
    - [ ] 驗證 messages 陣列從 user 訊息到 assistant 完整回應
    - [ ] 驗證 isTyping 狀態變化：false -> true -> false
    - [ ] 驗證 Pod output 更新

  - [ ] describe `工具使用流程`
    - [ ] sendMessage -> handleChatMessage -> handleChatToolUse -> handleChatToolResult -> handleChatComplete
    - [ ] 驗證 toolUse 狀態：running -> completed
    - [ ] 驗證 subMessage 包含 toolUse 資訊

  - [ ] describe `中止與 AutoClear`
    - [ ] 串流中 abortChat -> handleChatAborted
    - [ ] 驗證部分訊息被保留
    - [ ] AutoClear：handleWorkflowAutoCleared -> 訊息清空 + 動畫觸發

  - [ ] describe `歷史載入`
    - [ ] loadPodChatHistory -> 設定 messages
    - [ ] loadAllPodsHistory -> 多 Pod 並行載入 -> allHistoryLoaded

### 8.3 `tests/integration/copyPasteFlow.test.ts`

覆蓋 User Flow：Flow 3 完整流程

- [ ] describe `複製貼上/批量操作完整流程`
  - [ ] describe `框選 -> 複製 -> 貼上`
    - [ ] 框選多個 Pod 和 Note -> 複製到 clipboardStore -> 貼上到新位置
    - [ ] 驗證跨 Store 資料流：selectionStore -> clipboardStore -> podStore/noteStores

  - [ ] describe `框選 -> 批量拖曳`
    - [ ] 框選元素 -> 拖曳移動 -> 驗證所有元素座標更新
    - [ ] 驗證後端同步（syncPodPosition + updateNotePosition）

  - [ ] describe `框選 -> 批量刪除`
    - [ ] 框選元素 -> 刪除 -> 驗證所有 Store 中的資料已移除
    - [ ] 驗證 Selection 清空

  - [ ] describe `Ctrl 框選`
    - [ ] 第一次框選 -> Ctrl 第二次框選反選
    - [ ] 驗證 toggle 行為

---

## 9. 測試命名規範與風格

### 9.1 語言

- `describe` 和 `it` 描述使用 **zh-TW**
- 變數名和程式碼仍使用英文

### 9.2 檔案命名

- 測試檔案放在 `tests/` 目錄下，鏡射原始碼結構
- 測試檔案命名為 `{原始檔名}.test.ts`

### 9.3 describe/it 結構範例

```
describe('canvasStore', () => {
  describe('createCanvas', () => {
    it('成功建立 Canvas 後應更新 activeCanvasId', ...)
    it('WebSocket 回傳錯誤時應顯示失敗 Toast', ...)
  })
})
```

### 9.4 Arrange-Act-Assert 模式

每個 `it` 區塊遵循：
1. **Arrange**：設定前置條件（Mock 回應、初始狀態）
2. **Act**：執行被測方法
3. **Assert**：驗證結果

### 9.5 測試獨立性

- 每個測試案例必須獨立，不依賴其他測試的執行順序
- `beforeEach` 中重置所有 Store 和 Mock 狀態
- 避免共用可變狀態

---

## 10. 重構計畫

### 10.1 重構項目與優先級

以下重構在對應 Phase 的測試撰寫過程中同步進行：

#### 優先級 1（Phase 2 期間）

1. **`podStore.ts` - 提取 Pod 驗證邏輯**
   - 目前 `isValidPod` 是 Store action，應提取為獨立的純函數
   - 新位置：`src/lib/podValidation.ts`
   - 好處：可以獨立測試驗證邏輯，不需要 Pinia context
   - 提取內容：`isValidPod(pod: Pod): boolean`

2. **`podStore.ts` - 提取 `enrichPod` 為純函數**
   - 同上，提取到 `src/lib/podValidation.ts`
   - 提取內容：`enrichPod(pod: Pod, existingOutput?: string[]): Pod`

#### 優先級 2（Phase 4 期間）

3. **`chatMessageActions.ts` - 已經是良好的分離結構**
   - 目前已透過 `createMessageActions` 工廠模式分離
   - 無需大幅重構，但可進一步提取純函數（`updateSubMessageContent`, `finalizeToolUse` 等已經是模組頂層函數，結構良好）

#### 優先級 3（Phase 5 期間）

4. **`useCopyPaste.ts` (650 行) - 提取計算邏輯為獨立 Utils**
   - 提取位置計算邏輯到 `src/utils/copyPasteCalculations.ts`
   - 提取內容：
     - `calculateBoundingBox(pods, notes)` - 計算包圍框
     - `calculatePasteOffsets(boundingBox, targetPosition)` - 計算偏移量
     - `transformPodPositions(pods, offset)` - 轉換 Pod 座標
     - `transformNotePositions(notes, offset, getBoundKey)` - 轉換 Note 座標
   - 好處：650 行降至約 300 行，計算邏輯可獨立測試

5. **`useCopyPaste.ts` - 提取資料收集邏輯**
   - 提取到 `src/utils/copyPasteCollectors.ts`
   - 提取內容：
     - `collectSelectedPods(selectedElements, podStore)` - 收集 Pod 資料
     - `collectSelectedNotes(selectedElements, selectedPodIds, noteStores)` - 收集 Note 資料
     - `collectRelatedConnections(selectedPodIds, connections)` - 收集 Connection 資料
   - 好處：資料收集邏輯可獨立測試，不需要 DOM 事件和 Vue 生命週期

### 10.2 重構注意事項

- 重構不改變外部行為（API 簽名不變）
- 先寫測試，確認現有行為，再進行提取
- 每次重構後運行全部測試確保不破壞功能
- 重構範圍限制在邏輯提取，不做架構層級的大規模變動

---

## 附錄：測試覆蓋率目標

| 層級 | 目標覆蓋率 | 檔案數 |
|------|----------|--------|
| Utils | 95%+ | 5 個 |
| Lib | 95%+ | 2 個 |
| Services | 85%+ | 2 個 |
| Core Stores | 90%+ | 6 個 |
| Note Stores | 85%+ | 7 個 |
| Chat Store | 85%+ | 4 個 |
| Composables | 80%+ | 11 個 |
| 整合測試 | - | 3 個 |
| **總計** | **85%+** | **40 個測試檔** |

## 附錄：實施順序總結

1. Phase 1（預計 2-3 天）：基礎設施搭建 + 7 個 Utils/Lib/Services 測試檔
2. Phase 2（預計 3-4 天）：6 個 Core Store 測試檔 + 優先級 1 重構
3. Phase 3（預計 2-3 天）：7 個 Note Store 測試檔
4. Phase 4（預計 2-3 天）：4 個 Chat Store 測試檔
5. Phase 5（預計 3-4 天）：11 個 Composable 測試檔 + 優先級 3 重構
6. Phase 6（預計 2-3 天）：3 個整合測試檔

**總預估：14-20 天，產出約 40 個測試檔，覆蓋 45+ 測試場景**
