# 修復：WebSocket 斷線不應 abort Agent 查詢

## 背景

當用戶在前端送出訊息後按 F5 重整頁面，WebSocket 斷線會觸發 `abortQueriesByConnectionId`，導致 Agent 對話被中斷。期望行為是：只有前端主動按停止按鈕才 abort，斷線時 Agent 應繼續執行，重連後能看到完整回應。

## Userflow

1. 用戶送出訊息，Agent 開始回應（Pod 狀態為 chatting）
2. 用戶按 F5 重整頁面，WebSocket 斷線
3. Agent 在斷線期間繼續執行，串流訊息持續寫入 messageStore
4. 瀏覽器重新載入，建立新 WebSocket 連線，加入 canvas room
5. 重連後前端查詢 Pod 狀態，得知哪些 Pod 仍在 chatting
6. 若 Agent 仍在回應中，因新連線已加入 canvas room，`emitToCanvas` 會將後續串流事件送給新連線
7. 用戶按停止按鈕，以 podId 識別查詢並 abort（不再依賴 connectionId 匹配）

## 測試案例定義

- [ ] 建立 `backend/tests/unit/disconnectReconnect.test.ts`
  - WebSocket 斷線時不應 abort 活躍查詢
  - 斷線後 Agent 串流訊息仍持續寫入 messageStore
  - 重連後以新 connectionId 發送停止請求應能成功 abort
  - 重連後查詢聊天歷史應包含斷線期間的訊息

## 實作計畫

### 1. 移除 close handler 中的自動 abort

- [ ] 修改 `backend/src/index.ts`
  - 在 `close` handler 中，移除 `claudeQueryService.abortQueriesByConnectionId(connectionId)` 這一行及其上方的註解
  - 保留 `broadcastCursorLeft`、`socketService.cleanupSocket`、`canvasStore.removeSocket` 不動

### 2. 移除 `abortQueriesByConnectionId` 方法與 connectionId 欄位

- [ ] 修改 `backend/src/services/claude/queryService.ts`
  - 移除 `activeQueries` Map 中的 `connectionId` 欄位，將型別改為 `Map<string, { queryStream: Query; abortController: AbortController }>`
  - 移除 `abortQueriesByConnectionId` 方法（已無任何呼叫方）
  - 移除 `getQueryConnectionId` 方法（將在步驟 3 中不再需要）
  - 修改 `sendMessage` 方法簽名，移除 `connectionId` 參數
  - 修改 `sendMessageInternal` 方法簽名，移除 `connectionId` 參數
  - 修改 `this.activeQueries.set(podId, ...)` 那行，不再儲存 `connectionId`
  - 修改 `retryFn` 呼叫處（在 `handleSendMessageError` 中的 `retryFn`），移除 `connectionId` 參數

### 3. 移除停止按鈕的 connectionId 權限檢查

- [ ] 修改 `backend/src/handlers/chatHandlers.ts`
  - 在 `handleChatAbort` 中，移除 `claudeQueryService.getQueryConnectionId(podId)` 的呼叫及相關的 connectionId 權限檢查邏輯（第 111~136 行）
  - 簡化為：直接呼叫 `claudeQueryService.abortQuery(podId)`，不再比對 connectionId
  - 移除中間的 `queryConnectionId` 變數及其 null 檢查和 `UNAUTHORIZED` 錯誤回傳
  - 保留 `pod.status !== 'chatting'` 的前置檢查
  - 保留 `abortQuery` 回傳 false 時的 idle 重設和錯誤回傳邏輯

### 4. 移除 streamingChatExecutor 中的 connectionId 傳遞

- [ ] 修改 `backend/src/services/claude/streamingChatExecutor.ts`
  - 從 `StreamingChatExecutorOptions` 介面中移除 `connectionId` 欄位
  - 修改 `executeStreamingChat` 函式，不再從 options 解構 `connectionId`
  - 修改 `claudeQueryService.sendMessage` 的呼叫，移除 `connectionId` 參數

### 5. 修改所有呼叫 executeStreamingChat 的地方，移除 connectionId

- [ ] 修改 `backend/src/handlers/chatHandlers.ts`
  - 在 `handleChatSend` 中，呼叫 `executeStreamingChat` 時從 options 物件中移除 `connectionId` 欄位

- [ ] 搜尋專案中所有傳入 `connectionId` 給 `executeStreamingChat` 的地方並移除
  - 預期會出現在以下檔案（需確認）：
    - `backend/src/services/scheduleService.ts`
    - `backend/src/services/workflow/workflowExecutionService.ts`
    - `backend/src/services/workflow/workflowMultiInputService.ts`
  - 這些地方原本就沒有真實的 connectionId（排程和 workflow 不是由用戶直接觸發），移除即可

### 6. 移除 index.ts 中 queryService 的 import（如已無使用）

- [ ] 修改 `backend/src/index.ts`
  - 移除 `import { claudeQueryService } from './services/claude/queryService.js'`，因為 close handler 已不再呼叫任何 queryService 方法

### 7. 撰寫測試

- [ ] 建立 `backend/tests/unit/disconnectReconnect.test.ts`
  - **WebSocket 斷線時不應 abort 活躍查詢**
    - Mock `claudeQueryService` 的 `activeQueries`（或透過 `sendMessage` 建立活躍查詢）
    - 模擬 WebSocket close 事件
    - 驗證查詢的 `abortController.abort()` 沒有被呼叫
    - 驗證 Pod 狀態仍為 `chatting`
  - **斷線後 Agent 串流訊息仍持續寫入 messageStore**
    - 建立一個延遲完成的 mock query generator
    - 在查詢進行中模擬 WebSocket 斷線
    - 等待查詢完成後，驗證 messageStore 中有完整的訊息內容
  - **重連後以新 connectionId 發送停止請求應能成功 abort**
    - 由 connectionId-A 發起查詢
    - 模擬斷線後，以 connectionId-B 發送 `pod:chat:abort` 事件
    - 驗證 `abortQuery` 被成功呼叫，Pod 狀態回到 `idle`
  - **重連後查詢聊天歷史應包含斷線期間的訊息**
    - 發起查詢並在查詢進行中模擬斷線
    - 等待查詢完成
    - 以新連線查詢 `pod:chat:history`
    - 驗證回傳的訊息包含完整的 assistant 回應

### 8. 執行既有測試確認無破壞

- [ ] 執行 `bun run test` 確認所有既有測試通過
- [ ] 執行 `bun run style` 確認 ESLint 和 TypeScript 型別檢查通過
- [ ] 特別關注以下測試檔案可能因移除 connectionId 參數而需要同步修改：
  - `backend/tests/unit/query-service.test.ts` - `sendMessage` 呼叫處移除 connectionId 參數
  - `backend/tests/unit/streamingChatExecutor.test.ts` - `executeStreamingChat` 呼叫處移除 connectionId
  - `backend/tests/integration/chat.test.ts` - 整合測試中的相關呼叫
