# Workflow 層重構計畫書

## 總覽

三個主要任務 + 額外修正，按依賴順序排列。修改順序：型別定義 → Store → Service → 測試。

---

## 風險點

1. **DB Migration 不需要**：`PathwayState` 在 DB 層仍使用 `0/1/NULL`，轉換邏輯集中在 `runStore.ts` 的 `rowToRunPodInstance` / `createPodInstance`，SQL schema 和 statements 不變
2. **前端同步必須**：前端 `frontend/src/types/run.ts`、`frontend/src/stores/run/runStore.ts`、`frontend/src/types/websocket/responses.ts`、`frontend/src/composables/eventHandlers/runEventHandlers.ts` 都使用 `boolean | null`，需同步改為 `PathwayState`
3. **WebSocket wire format 變更**：`RunPodStatusChangedPayload` 的 `autoPathwaySettled` / `directPathwaySettled` 從 `boolean | null` 改為 `PathwayState` 字串，前後端需同步部署
4. **WorkflowStatusDelegate 影響面廣**：27+ 處分支散布在 5 個 service 檔案中，需逐檔確認每個 `if (runContext)` 都被 delegate 方法取代
5. **Delegate 介面設計需仔細**：不同 service 對 delegate 的需求不同（有些需要 emitEvent，有些需要 updateConnectionStatus），介面要涵蓋所有用途但不過度膨脹

---

## 測試案例定義

### 新增 `backend/tests/unit/pathwayState.test.ts`
- pathwayStateToSqliteInt 將 'not-applicable' 轉為 NULL
- pathwayStateToSqliteInt 將 'pending' 轉為 0
- pathwayStateToSqliteInt 將 'settled' 轉為 1
- sqliteIntToPathwayState 將 NULL 轉為 'not-applicable'
- sqliteIntToPathwayState 將 0 轉為 'pending'
- sqliteIntToPathwayState 將 1 轉為 'settled'
- isAllPathwaysSettled 雙路徑皆 settled 回傳 true
- isAllPathwaysSettled 有 pending 回傳 false
- isAllPathwaysSettled 一個 not-applicable 一個 settled 回傳 true
- isAllPathwaysSettled 雙路徑皆 not-applicable 回傳 true

### 新增 `backend/tests/unit/settlementPathway.test.ts`
- resolveSettlementPathway 將 auto 模式解析為 'auto'
- resolveSettlementPathway 將 ai-decide 模式解析為 'auto'
- resolveSettlementPathway 將 direct 模式解析為 'direct'

### 新增 `backend/tests/unit/workflowStatusDelegate.test.ts`
- NormalModeDelegate.startPodExecution 呼叫 podStore.setStatus('chatting')
- NormalModeDelegate.markSummarizing 呼叫 podStore.setStatus('summarizing')
- NormalModeDelegate.onSummaryComplete 呼叫 podStore.setStatus('idle')
- NormalModeDelegate.onChatError 呼叫 podStore.setStatus('idle')
- NormalModeDelegate.updateConnectionStatus 呼叫 connectionStore.updateConnectionStatus
- NormalModeDelegate.shouldEnqueue 回傳 true
- NormalModeDelegate.scheduleNextInQueue 呼叫 workflowQueueService.processNextInQueue
- NormalModeDelegate.settleAndSkipPath 不執行任何操作
- RunModeDelegate.startPodExecution 呼叫 runExecutionService.startPodInstance
- RunModeDelegate.markSummarizing 呼叫 runExecutionService.summarizingPodInstance
- RunModeDelegate.markDeciding 呼叫 runExecutionService.decidingPodInstance
- RunModeDelegate.markWaiting 呼叫 runExecutionService.waitingPodInstance
- RunModeDelegate.onSummaryComplete 呼叫 runExecutionService.settlePodTrigger
- RunModeDelegate.onSummaryFailed 呼叫 runExecutionService.errorPodInstance
- RunModeDelegate.onChatComplete 呼叫 runExecutionService.settlePodTrigger
- RunModeDelegate.onChatError 呼叫 runExecutionService.errorPodInstance
- RunModeDelegate.updateConnectionStatus 不呼叫 connectionStore
- RunModeDelegate.shouldEnqueue 回傳 false
- RunModeDelegate.scheduleNextInQueue 不執行任何操作
- RunModeDelegate.settleAndSkipPath 呼叫 runExecutionService.settleAndSkipPath
- createStatusDelegate 有 runContext 時建立 RunModeDelegate
- createStatusDelegate 無 runContext 時建立 NormalModeDelegate

### 新增 `backend/tests/unit/runExecutionHelpers.test.ts`
- isInstanceUnreachable 偵測 auto 路徑不可達（來源 skipped）
- isInstanceUnreachable 偵測 auto 路徑不可達（來源 error）
- isInstanceUnreachable direct 路徑部分來源存活時不視為不可達
- isInstanceUnreachable 偵測 direct 路徑不可達（全部來源 skipped/error）
- isInstanceUnreachable 已 settled 的路徑不再檢查
- isInstanceUnreachable 無 incoming connections 時不視為不可達

### 現有測試需要更新
- `backend/tests/mocks/workflowTestFactories.ts`：`createMockRunPodInstance` 的 `autoPathwaySettled` / `directPathwaySettled` 改為 `PathwayState`
- `backend/tests/mocks/workflowSpySetup.ts`：`setupRunStoreSpy` 中 `createPodInstance` mock 的回傳值改為 `PathwayState`

---

## 任務 0：定義 `SettlementPathway` 具名型別

- [ ] 在 `backend/src/services/workflow/types.ts` 頂部新增型別定義
  - `export type SettlementPathway = 'auto' | 'direct'`
  - JSDoc：`/** settle 階段的路徑類別。ai-decide 在 settle 時歸類為 'auto' */`

- [ ] 在 `backend/src/services/workflow/workflowHelpers.ts` 新增 `resolveSettlementPathway` helper
  - 簽名：`(triggerMode: TriggerMode) => SettlementPathway`
  - 實作：`return isAutoTriggerable(triggerMode) ? 'auto' : 'direct'`

- [ ] 替換所有內聯 `'auto' | 'direct'` pathway 型別，改為引用 `SettlementPathway`
  - `backend/src/services/workflow/workflowExecutionService.ts` 行 53 `updateSummaryStatus` 的 `pathway` 參數型別
  - `backend/src/services/workflow/workflowExecutionService.ts` 行 75 `generateSummaryWithFallback` 的 `pathway` 參數型別
  - `backend/src/services/workflow/runExecutionService.ts` 行 127 `settlePathwayAndRefresh` 的 `pathway` 參數型別
  - `backend/src/services/workflow/runExecutionService.ts` 行 151 `settlePodTrigger` 的 `pathway` 參數型別
  - `backend/src/services/workflow/runExecutionService.ts` 行 160 `settleAndSkipPath` 的 `pathway` 參數型別
  - `backend/src/services/workflow/types.ts` 行 117 `ExecutionServiceMethods.generateSummaryWithFallback` 的 `pathway` 參數型別

- [ ] 替換計算 pathway 的地方改用 `resolveSettlementPathway`
  - `backend/src/services/workflow/workflowPipeline.ts` 行 48：`const pathway = resolveSettlementPathway(triggerMode)` 取代 `isAutoTriggerable(triggerMode) ? 'auto' : 'direct'`
  - `backend/src/services/workflow/workflowExecutionService.ts` 行 239：`const pathway = resolveSettlementPathway(strategy.mode)` 取代 `isAutoTriggerable(strategy.mode) ? 'auto' : 'direct'`

---

## 任務 1：`boolean | null` 三值語義改為 `PathwayState` enum

- [ ] 在 `backend/src/types/run.ts` 新增型別
  - `export type PathwayState = 'not-applicable' | 'pending' | 'settled'`
  - JSDoc：`/** not-applicable: 該路徑不存在; pending: 尚未 settle; settled: 已完成 settle */`

- [ ] 在 `backend/src/utils/pathwayHelpers.ts` 建立新檔案，定義轉換函數與判斷函數（供 runStore 和測試使用）
  - `pathwayStateToSqliteInt(state: PathwayState): number | null`
    - `'not-applicable'` → `null`
    - `'pending'` → `0`
    - `'settled'` → `1`
  - `sqliteIntToPathwayState(value: number | null): PathwayState`
    - `null` → `'not-applicable'`
    - `0` → `'pending'`
    - `1` → `'settled'`
  - `isAllPathwaysSettled(auto: PathwayState, direct: PathwayState): boolean`
    - 當兩條路徑皆為 `'not-applicable'` 或 `'settled'` 時回傳 `true`
    - 任一為 `'pending'` 時回傳 `false`

- [ ] 修改 `backend/src/services/runStore.ts`
  - 匯入 `PathwayState` from `'../types/run.js'`
  - 匯入 `pathwayStateToSqliteInt`, `sqliteIntToPathwayState` from `'../utils/pathwayHelpers.js'`
  - 刪除原有的 `booleanToSqliteInt` 和 `sqliteIntToBoolean` 兩個 module-private 函數
  - `RunPodInstance` 介面：`autoPathwaySettled: boolean | null` → `autoPathwaySettled: PathwayState`，`directPathwaySettled` 同理
  - `rowToRunPodInstance` 中改用 `sqliteIntToPathwayState(row.auto_pathway_settled)` 等
  - `createPodInstance` 方法簽名：參數從 `autoPathwaySettled: boolean | null = null` 改為 `autoPathwaySettled: PathwayState = 'not-applicable'`，`directPathwaySettled` 同理
  - `createPodInstance` 中 instance 物件和 DB insert 使用 `pathwayStateToSqliteInt()`

- [ ] 修改 `backend/src/types/run.ts` 的 `RunPodStatusChangedPayload`
  - 行 40：`autoPathwaySettled?: boolean | null` → `autoPathwaySettled?: PathwayState`
  - 行 41：`directPathwaySettled?: boolean | null` → `directPathwaySettled?: PathwayState`

- [ ] 修改 `backend/src/services/workflow/runExecutionService.ts`
  - 匯入 `PathwayState` from `'../../types/run.js'`
  - 匯入 `isAllPathwaysSettled` from `'../../utils/pathwayHelpers.js'`
  - `calculatePathways` 回傳型別改為 `{ autoPathwaySettled: PathwayState; directPathwaySettled: PathwayState }`
    - 行 83：`{ autoPathwaySettled: false, directPathwaySettled: null }` → `{ autoPathwaySettled: 'pending', directPathwaySettled: 'not-applicable' }`
    - 行 90：同上模式
    - 行 97：`hasAutoTriggerable ? false : null` → `hasAutoTriggerable ? 'pending' : 'not-applicable'`
    - 行 98：`hasDirect ? false : null` → `hasDirect ? 'pending' : 'not-applicable'`
  - 刪除 private `isAllPathwaysSettled` 方法（行 102-107），改用從 `pathwayHelpers.ts` 匯入的版本
  - `settlePodTrigger` 行 155：`this.isAllPathwaysSettled(updated)` → `isAllPathwaysSettled(updated.autoPathwaySettled, updated.directPathwaySettled)`
  - `settleAndSkipPath` 行 162：同上
  - `settleUnreachablePaths` 中的判斷邏輯：
    - 行 197：`instance.autoPathwaySettled === false` → `instance.autoPathwaySettled === 'pending'`
    - 行 205：`instance.directPathwaySettled === false` → `instance.directPathwaySettled === 'pending'`
    - 行 214：`instance.autoPathwaySettled = true` → `instance.autoPathwaySettled = 'settled'`
    - 行 219：`instance.directPathwaySettled = true` → `instance.directPathwaySettled = 'settled'`
    - 行 223：`this.isAllPathwaysSettled(instance)` → `isAllPathwaysSettled(instance.autoPathwaySettled, instance.directPathwaySettled)`

- [ ] 同步修改前端（或建立 follow-up ticket）
  - `frontend/src/types/run.ts` 行 15-16：改為 `PathwayState`
  - `frontend/src/types/websocket/responses.ts` 行 526-527：改為 `PathwayState`
  - `frontend/src/stores/run/runStore.ts` 行 144-145, 166-170：payload 接收邏輯調整
  - 前端需新增 `PathwayState` 型別定義

---

## 任務 2：建立 `WorkflowStatusDelegate` 消除 `if (!runContext)` 散落分支

### 步驟 2-1：定義介面與實作

- [ ] 建立 `backend/src/services/workflow/workflowStatusDelegate.ts`
  - 定義 `WorkflowStatusDelegate` 介面，方法清單：
    - `startPodExecution(canvasId: string, podId: string): void` — normal: `podStore.setStatus(canvasId, podId, 'chatting')`, run: `runExecutionService.startPodInstance(runContext, podId)`
    - `markSummarizing(canvasId: string, podId: string): void` — normal: `podStore.setStatus(canvasId, podId, 'summarizing')`, run: `runExecutionService.summarizingPodInstance(runContext, podId)`
    - `markDeciding(canvasId: string, podId: string): void` — normal: 無操作, run: `runExecutionService.decidingPodInstance(runContext, podId)`
    - `markWaiting(canvasId: string, podId: string): void` — normal: 無操作（connection status 由各 strategy 自行處理）, run: `runExecutionService.waitingPodInstance(runContext, podId)`
    - `onSummaryComplete(canvasId: string, podId: string, pathway: SettlementPathway): void` — normal: `podStore.setStatus(canvasId, podId, 'idle')`, run: `runExecutionService.settlePodTrigger(runContext, podId, pathway)`
    - `onSummaryFailed(canvasId: string, podId: string, errorMessage: string): void` — normal: `podStore.setStatus(canvasId, podId, 'idle')`, run: `runExecutionService.errorPodInstance(runContext, podId, errorMessage)`
    - `onChatComplete(canvasId: string, podId: string, pathway: SettlementPathway): void` — normal: 無操作, run: `runExecutionService.settlePodTrigger(runContext, podId, pathway)`
    - `onChatError(canvasId: string, podId: string, errorMessage: string): void` — normal: `podStore.setStatus(canvasId, podId, 'idle')`, run: `runExecutionService.errorPodInstance(runContext, podId, errorMessage)`
    - `shouldEnqueue(): boolean` — normal: `true`, run: `false`
    - `scheduleNextInQueue(canvasId: string, targetPodId: string): void` — normal: `fireAndForget(workflowQueueService.processNextInQueue(...))`, run: 無操作
    - `isRunMode(): boolean` — normal: `false`, run: `true`（供少數仍需判斷模式的地方使用，如 connection status 是否要更新的判斷）
    - `settleAndSkipPath(canvasId: string, podId: string, pathway: SettlementPathway): void` — normal: 無操作, run: `runExecutionService.settleAndSkipPath(runContext, podId, pathway)`

- [ ] 實作 `NormalModeDelegate` class
  - 所有方法按上述「normal」欄位實作
  - 不需要任何建構子參數

- [ ] 實作 `RunModeDelegate` class
  - 建構子接收 `runContext: RunContext`，存為 private readonly 欄位
  - 所有方法按上述「run」欄位實作

- [ ] export 工廠函數 `createStatusDelegate(runContext?: RunContext): WorkflowStatusDelegate`
  - 有 `runContext` → `new RunModeDelegate(runContext)`
  - 無 `runContext` → `new NormalModeDelegate()`

### 步驟 2-2：將 delegate 加入 context 型別

- [ ] 修改 `backend/src/services/workflow/types.ts` 中需要 delegate 的介面
  - `PipelineContext` 新增 `delegate: WorkflowStatusDelegate`
  - `TriggerLifecycleContext` 新增 `delegate: WorkflowStatusDelegate`
  - `CompletionContext` 新增 `delegate: WorkflowStatusDelegate`
  - `QueuedContext` 新增 `delegate: WorkflowStatusDelegate`
  - `QueueProcessedContext` 新增 `delegate: WorkflowStatusDelegate`
  - `CollectSourcesContext` 新增 `delegate: WorkflowStatusDelegate`
  - `TriggerWorkflowWithSummaryParams` 新增 `delegate: WorkflowStatusDelegate`
  - `HandleMultiInputForConnectionParams` 新增 `delegate: WorkflowStatusDelegate`
  - 注意：保留所有介面中的 `runContext?: RunContext`，因為底層呼叫（`injectRunUserMessage`、`executeStreamingChat`、`summaryService.generateSummaryForTarget`、`runStore` 查詢）仍需要原始 runContext
  - 匯入 `WorkflowStatusDelegate` type

### 步驟 2-3：修改 Pipeline 層注入 delegate

- [ ] 修改 `backend/src/services/workflow/workflowPipeline.ts`
  - `execute` 方法中：`const delegate = createStatusDelegate(runContext)` 放入 context
  - 行 68 `if (!runContext && targetPod.status !== 'idle')`：改為 `if (delegate.shouldEnqueue() && targetPod.status !== 'idle')`
  - 傳遞 delegate 到 `runCollectSourcesStage` 和 `executionService.triggerWorkflowWithSummary`

### 步驟 2-4：替換 workflowExecutionService.ts 中的分支

- [ ] 修改 `backend/src/services/workflow/workflowExecutionService.ts`
  - `generateSummaryWithFallback`（行 77-81）：從 params 取出 delegate，呼叫 `delegate.markSummarizing(canvasId, sourcePodId)` 取代 if/else
  - `updateSummaryStatus`（行 53-68）：整個方法重構
    - 移除方法，將邏輯內聯到 `generateSummaryWithFallback` 中
    - 成功時：`delegate.onSummaryComplete(canvasId, sourcePodId, pathway)`
    - 失敗且無 fallback 時：`delegate.onSummaryFailed(canvasId, sourcePodId, '無法生成摘要')`
    - 失敗但有 fallback 時：若有 pathway 則 `delegate.onSummaryComplete(canvasId, sourcePodId, pathway)`，否則 `delegate.onSummaryComplete(canvasId, sourcePodId, 'auto')` 作為預設
  - `triggerWorkflowWithSummary`（行 178-182）：`delegate.startPodExecution(canvasId, targetPodId)` 取代 if/else
  - `setConnectionsToActive`（行 211-212）：`if (delegate.isRunMode()) return` 取代 `if (runContext) return`
  - `onWorkflowChatComplete`（行 238-241）：`delegate.onChatComplete(canvasId, targetPodId, pathway)` 取代 if 分支
  - `onWorkflowChatComplete`（行 249-251）：`delegate.scheduleNextInQueue(canvasId, targetPodId)` 取代 `if (!runContext)` 分支
  - `onWorkflowChatError`（行 262-267）：`delegate.onChatError(canvasId, targetPodId, error.message)` 取代 if/else，接著 `delegate.scheduleNextInQueue(canvasId, targetPodId)`
  - `executeClaudeQuery`（行 277-281）：保留 `runContext` 判斷（`injectRunUserMessage` vs `injectUserMessage` 是資料操作不是狀態管理），或用 `delegate.isRunMode()` 判斷

### 步驟 2-5：替換 workflowAutoTriggerService.ts 中的分支

- [ ] 修改 `backend/src/services/workflow/workflowAutoTriggerService.ts`
  - `getLastAssistantMessage`（行 42-63）：保留 runContext 判斷（資料查詢，不屬於 delegate 職責）
  - `onTrigger`（行 99-100）：`if (context.delegate.isRunMode()) return` 取代 `if (context.runContext) return`
  - `onQueued`（行 121-122）：`if (context.delegate.isRunMode()) return` 取代 `if (context.runContext) return`

### 步驟 2-6：替換 workflowAiDecideTriggerService.ts 中的分支

- [ ] 修改 `backend/src/services/workflow/workflowAiDecideTriggerService.ts`
  - `onTrigger`（行 49-50）：`if (context.delegate.isRunMode()) return` 取代
  - `setConnectionsToDeciding`（行 126-127）：`if (delegate.isRunMode()) return` 取代，delegate 從參數傳入
  - `processAiDecideConnections`（行 165-167）：透過 `delegate.isRunMode()` 判斷是否 emit pending 事件
  - `processAiDecideConnections`（行 171-176）：改用迴圈呼叫 `delegate.markDeciding(canvasId, targetPodId)`，normal mode 下 markDeciding 是空操作，所以不需要額外判斷
  - `handleErrorConnection`（行 193-205）：
    - normal mode 分支（`!delegate.isRunMode()`）：connectionStore + eventEmitter 操作保持不變
    - run mode 分支：`delegate.onChatError(canvasId, connection.targetPodId, errorMessage)` 取代直接呼叫 runExecutionService
  - `handleApprovedConnection`（行 219-230）：`if (!delegate.isRunMode())` 取代 `if (!runContext)`
  - `triggerApprovedPipeline`（行 256-266）：`if (!delegate.isRunMode())` 取代 `if (!runContext)`
  - `handleRejectedConnection`（行 306-311）：
    - normal mode：connectionStore.updateDecideStatus + updateConnectionStatus 保持不變
    - run mode：`delegate.settleAndSkipPath(canvasId, connection.targetPodId, 'auto')` 取代直接呼叫 runExecutionService
  - `emitRejectionEvents`（行 277）：`if (delegate.isRunMode()) return` 取代
  - `onQueued`（行 69-70）：`if (context.delegate.isRunMode()) return` 取代

### 步驟 2-7：替換 workflowDirectTriggerService.ts 中的分支

- [ ] 修改 `backend/src/services/workflow/workflowDirectTriggerService.ts`
  - `handleMultiDirectTrigger`（行 77-81）：`delegate.markWaiting(canvasId, targetPodId)` 取代 run mode 分支；normal mode 的 `connectionStore.updateConnectionStatus` 保留（因為是 connection 層級操作）
    - 方案：if `delegate.isRunMode()` 呼叫 `delegate.markWaiting`，else 呼叫 `connectionStore.updateConnectionStatus`
  - `handleMultiDirectTrigger`（行 89-91）：`if (!delegate.isRunMode())` 取代 `if (!runContext)`
  - `onTrigger`（行 185-186）：`if (context.delegate.isRunMode()) return` 取代
  - `onComplete`（行 205-206）：`if (context.delegate.isRunMode()) return` 取代
  - `onQueued`（行 231-232）：`if (context.delegate.isRunMode()) return` 取代
  - `onQueueProcessed`（行 252-253）：`if (context.delegate.isRunMode()) return` 取代
  - `processTimerResult`（行 165-174）：`if (!delegate.isRunMode())` 取代 `if (!runContext)`

### 步驟 2-8：替換 workflowMultiInputService.ts 中的分支

- [ ] 修改 `backend/src/services/workflow/workflowMultiInputService.ts`
  - `handleMultiInputForConnection`（行 139-145）：`if (delegate.shouldEnqueue())` 取代 `if (!runContext)`
  - `triggerMergedWorkflow`（行 161-163）：normal mode 下 `delegate.startPodExecution(canvasId, targetPodId)` 取代（注意：這裡 normal mode 是 `podStore.setStatus(chatting)` 不是 `startPodExecution`，但 delegate.startPodExecution 的語義就是設為 chatting，所以可以用）
    - 或用 `if (!delegate.isRunMode()) podStore.setStatus(...)` 保持現狀，差異不大
  - `triggerMergedWorkflow`（行 175-181）：`if (!delegate.isRunMode())` 取代 `if (!runContext)`

### 步驟 2-9：替換 workflowHelpers.ts 和 workflowStateService.ts

- [ ] 修改 `backend/src/services/workflow/workflowHelpers.ts` 的 `completeMultiInputConnections`
  - 行 89 `if (!context.runContext)`：改為 `if (!context.delegate.isRunMode())`

- [ ] 修改 `backend/src/services/workflow/workflowStateService.ts`
  - `emitPendingStatus`（行 77-78）：`if (delegate.isRunMode()) return` 取代 `if (runContext) return`
  - 此方法的參數需要從 `runContext?: RunContext` 改為接收 delegate 或直接接收 boolean flag
  - 或保留 runContext 參數不變（因為 workflowStateService 不在 pipeline 流程中，呼叫方可能不持有 delegate）
  - **建議**：保留 runContext 判斷，不改此處，因為 workflowStateService 主要被 pipeline 之外的場景呼叫

### 步驟 2-10：更新建立 PipelineContext 的地方

- [ ] 確保所有建立 `PipelineContext` 的地方都傳入 delegate
  - `workflowAutoTriggerService.ts` 行 82-94：`processAutoTriggerConnection` 建立 context 時加入 `delegate: createStatusDelegate(runContext)`
  - `workflowAiDecideTriggerService.ts` 行 245-252：`triggerApprovedPipeline` 建立 context 時加入 delegate
  - `workflowExecutionService.ts` 行 117-124：`triggerDirectConnections` 建立 context 時加入 delegate
  - `workflowQueueService.ts` 行 117-124：`processNextInQueue` 呼叫 `triggerWorkflowWithSummary` 時傳入 delegate

### 步驟 2-11：確認 initWorkflowServices 不需更新

- [ ] 確認 `backend/src/services/workflow/index.ts` 不需要額外修改
  - delegate 是在 pipeline execute 時動態建立的，不需要在 init 階段注入

---

## 任務 3：額外相關修正

### 3-1：`settleUnreachablePaths` 三層嵌套 → 抽出 `isInstanceUnreachable` 純函數

- [ ] 在 `backend/src/services/workflow/runExecutionService.ts` 中 class 外部定義純函數 `isInstanceUnreachable`
  - 簽名：`(instance: RunPodInstance, incomingConns: Connection[], allInstances: RunPodInstance[]) => { autoUnreachable: boolean; directUnreachable: boolean }`
  - 內容提取自 `settleUnreachablePaths` 行 190-210 的邏輯：
    - 過濾 `autoConns`（`isAutoTriggerable(c.triggerMode)`）和 `directConns`（`c.triggerMode === 'direct'`）
    - `autoUnreachable`：`instance.autoPathwaySettled === 'pending'`（任務 1 改後）且 autoConns 中有任一 source 是 skipped/error
    - `directUnreachable`：`instance.directPathwaySettled === 'pending'`（任務 1 改後）且 directConns 全部 source 是 skipped/error
  - export 此函數供測試使用
  - `settleUnreachablePaths` 的 for 迴圈內改為：`const { autoUnreachable, directUnreachable } = isInstanceUnreachable(instance, incomingConns, instances)`

### 3-2：`isSummarized` 命名統一

- [ ] 修改 `backend/src/services/workflow/workflowPipeline.ts`
  - `runCollectSourcesStage` 的參數名稱：`summaryIsCondensedSummary` → `isSummarized`（行 105）
  - 回傳型別中的 `finalIsCondensedSummary` → `finalIsSummarized`（行 106 回傳型別，行 65、76、94、126、129、150 所有使用處）

### 3-3：`workflowAiDecideTriggerService` 取 pod + formatLog 重複 → 抽出 `buildConnectionLog`

- [ ] 在 `workflowAiDecideTriggerService.ts` 中新增 private method `buildConnectionLog`
  - 簽名：`(canvasId: string, sourcePodId: string, connection: Connection) => string`
  - 實作：取 sourcePod 和 targetPod，呼叫 `formatConnectionLog({...})`
  - 替換三處重複程式碼：
    - `handleErrorConnection` 行 206-208
    - `handleApprovedConnection` 行 231-233
    - `emitRejectionEvents` 行 286-288

### 3-4：`workflowEventEmitter` emit 模式重複 → 抽出 private `emit` helper

- [ ] 在 `backend/src/services/workflow/workflowEventEmitter.ts` 中新增 private method
  - 簽名：`private emit(canvasId: string, event: WebSocketResponseEvents, payload: Record<string, unknown>): void`
  - 實作：`socketService.emitToCanvas(canvasId, event, payload)`
  - 替換類別中所有 `socketService.emitToCanvas(canvasId, ...)` 呼叫（共 13 處）

### 3-5：`workflowDirectTriggerService` 迴圈重複 → 抽出 `forEachParticipatingConnection`

- [ ] 在 `workflowDirectTriggerService.ts` 中新增 private method `forEachParticipatingConnection`
  - 簽名：`(canvasId: string, participatingConnectionIds: string[], callback: (conn: Connection) => void): void`
  - 實作：`this.getConnectionsToIterate(canvasId, participatingConnectionIds).forEach(callback)`
  - 替換四處重複模式：
    - `onTrigger`（行 188-202）
    - `onComplete`（行 208-224）
    - `onQueued`（行 234-245）
    - `onQueueProcessed`（行 255-265）

### 3-6：`updateSummaryStatus` 簡化

- [ ] 在任務 2 完成後評估
  - 如果 delegate 已完全取代此方法的邏輯，直接刪除 `updateSummaryStatus` 方法
  - 將成功/失敗的 delegate 呼叫內聯到 `generateSummaryWithFallback` 中

### 3-7：`handleMultiInputForConnection` 的 `requiredSourcePodIds` 改為內部計算

- [ ] 修改 `backend/src/services/workflow/types.ts`
  - `HandleMultiInputForConnectionParams` 介面中移除 `requiredSourcePodIds: string[]` 欄位

- [ ] 修改 `backend/src/services/workflow/workflowMultiInputService.ts`
  - `handleMultiInputForConnection` 開頭新增：呼叫 `workflowStateService.checkMultiInputScenario(canvasId, connection.targetPodId)` 取得 `requiredSourcePodIds`
  - 需要新增 `workflowStateService` 依賴：在 `MultiInputServiceDeps` 介面中加入 `stateService`，或直接 import `workflowStateService` 使用

- [ ] 修改 `backend/src/services/workflow/workflowPipeline.ts`
  - `runCollectSourcesStage`（行 132-148）中移除 `stateService.checkMultiInputScenario` 呼叫
  - 移除 `requiredSourcePodIds` 傳遞
  - `PipelineDeps` 中移除 `stateService: StateServiceMethods`（如果 pipeline 不再需要 stateService）
  - 簡化：直接呼叫 `multiInputService.handleMultiInputForConnection` 並由 multiInputService 自行判斷是否為 multi-input

- [ ] 修改 `backend/src/services/workflow/index.ts`
  - `workflowPipeline.init({...})` 中移除 `stateService`（如果已不需要）
  - `workflowMultiInputService.init({...})` 中新增 `stateService: workflowStateService`（如果改為 DI）

---

## 任務 4：撰寫測試

- [ ] 建立 `backend/tests/unit/pathwayState.test.ts`
  - 匯入 `pathwayStateToSqliteInt`, `sqliteIntToPathwayState`, `isAllPathwaysSettled` from pathwayHelpers
  - 撰寫上方定義的 10 個測試案例

- [ ] 建立 `backend/tests/unit/settlementPathway.test.ts`
  - 匯入 `resolveSettlementPathway` from workflowHelpers
  - 撰寫上方定義的 3 個測試案例

- [ ] 建立 `backend/tests/unit/workflowStatusDelegate.test.ts`
  - 使用 `workflowSpySetup.ts` 中的 spy 設定
  - 匯入 `createStatusDelegate`, `NormalModeDelegate`, `RunModeDelegate`
  - 匯入 `createMockRunContext` from workflowTestFactories
  - 撰寫上方定義的 22 個測試案例
  - beforeEach 設定所有必要 spy

- [ ] 建立 `backend/tests/unit/runExecutionHelpers.test.ts`
  - 匯入 `isInstanceUnreachable` from runExecutionService
  - 匯入 `createMockRunPodInstance`, `createMockConnection` from workflowTestFactories
  - 撰寫上方定義的 6 個測試案例

- [ ] 更新 `backend/tests/mocks/workflowTestFactories.ts`
  - `createMockRunPodInstance` 預設值：`autoPathwaySettled: 'not-applicable'`, `directPathwaySettled: 'not-applicable'`

- [ ] 更新 `backend/tests/mocks/workflowSpySetup.ts`
  - `setupRunStoreSpy` 的 `createPodInstance` mock 回傳值中 pathway 欄位改為 `'not-applicable'`

- [ ] 執行 `bun run test` 確認所有測試通過
- [ ] 執行 `bun run style` 確認 eslint 與 type 檢查通過

---

## 建議實作順序

1. **任務 0** — SettlementPathway 型別（最小、無風險、其他任務的前置依賴）
2. **任務 1** — PathwayState enum（獨立，只碰 runStore + runExecutionService + types）
3. **任務 3-1** — isInstanceUnreachable 純函數抽取（搭配任務 1 的 PathwayState 一起改 settleUnreachablePaths）
4. **任務 3-2** — isSummarized 命名統一（獨立小改動，無依賴）
5. **任務 3-3** — buildConnectionLog 抽取（獨立小改動）
6. **任務 3-4** — workflowEventEmitter emit helper（獨立小改動）
7. **任務 3-5** — forEachParticipatingConnection 抽取（獨立小改動）
8. **任務 3-7** — requiredSourcePodIds 內部化（獨立，減少 pipeline 複雜度）
9. **任務 2** — WorkflowStatusDelegate（最大任務，在其他清理完成後雜訊最少）
10. **任務 3-6** — updateSummaryStatus 簡化（依賴任務 2 完成後才知道能否刪除）
11. **任務 4** — 撰寫測試（建議每完成一個任務就同步寫對應測試，而非最後集中寫）
