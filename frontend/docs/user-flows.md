# Frontend User Flows

本文件定義了三大核心 User Flow，專注於前端邏輯測試（Stores、Composables、Utils），WebSocket 通訊將被 Mock。

---

## Flow 1: Canvas/Pod 操作流程

### 1.1 建立 Canvas

**涉及層級**
- Store: `canvasStore`
- Utils: `createWebSocketRequest`

**步驟**

1. **用戶觸發建立 Canvas**
   - Input: `name: string`
   - Action: `canvasStore.createCanvas(name)`
   - Mock WS: `CANVAS_CREATE` → `CANVAS_CREATED`
   - 預期輸出:
     - `canvases` 陣列增加新 Canvas
     - `activeCanvasId` 設為新 Canvas ID
     - Toast 顯示「建立成功」

2. **建立失敗情境**
   - Mock WS 回傳錯誤
   - 預期輸出:
     - `canvases` 陣列不變
     - Toast 顯示「建立失敗」+ 錯誤訊息

**邊界情況**
- 空白名稱
- 重複名稱
- WebSocket 超時

---

### 1.2 建立 Pod

**涉及層級**
- Store: `podStore`, `canvasStore`
- Utils: `createWebSocketRequest`, `validatePodName`

**步驟**

1. **用戶建立 Pod**
   - Input: `{name, color, x, y, rotation}`
   - Action: `podStore.createPodWithBackend(pod)`
   - Mock WS: `POD_CREATE` → `POD_CREATED`
   - 預期輸出:
     - `pods` 陣列增加新 Pod
     - Pod 預設值: `model: 'opus'`, `autoClear: false`, `output: []`
     - Toast 顯示「建立成功」

2. **Pod 驗證失敗**
   - Input: 無效的 `name` 或 `color`
   - 預期輸出: `isValidPod()` 返回 `false`，拒絕新增

**邊界情況**
- 沒有啟用的 Canvas (`activeCanvasId === null`)
- Pod 名稱包含非法字元
- 座標超出範圍 (`MAX_COORD`)

---

### 1.3 設定 Pod Model

**涉及層級**
- Store: `podStore`
- Utils: `createWebSocketRequest`

**步驟**

1. **用戶選擇 Model**
   - Input: `podId: string`, `model: 'opus' | 'sonnet' | 'haiku'`
   - Action: `podStore.setModel(podId, model)`
   - Mock WS: `POD_MODEL_SET` → `POD_MODEL_UPDATED`
   - 預期輸出:
     - 對應 Pod 的 `model` 欄位更新
     - Toast 顯示「模型設定成功」

**邊界情況**
- Pod 不存在
- 無效的 Model 類型

---

### 1.4 綁定 Note 到 Pod Slot

**涉及層級**
- Store: 各類 `noteStore` (outputStyleStore, skillStore, repositoryStore, subAgentStore, commandStore)
- Composables: `useSlotDropTarget`

**步驟**

1. **OutputStyle Note 綁定**
   - Input: `noteId: string`, `podId: string`
   - Action: `outputStyleStore.bindToPod(noteId, podId)`
   - Mock WS: `OUTPUT_STYLE_BIND` → `OUTPUT_STYLE_BOUND`
   - 預期輸出:
     - Note 的 `boundToPodId` 設為 `podId`
     - Pod 的 `outputStyleId` 設為 `noteId`
     - Note 座標更新至 Pod 附近

2. **Skill Note 綁定（多對多關係）**
   - Input: `skillId: string`, `podId: string`
   - Action: `skillStore.bindToPod(skillId, podId)`
   - Mock WS: `SKILL_BIND` → `SKILL_BOUND`
   - 預期輸出:
     - Note 的 `boundToPodId` 設為 `podId`
     - Pod 的 `skillIds` 陣列增加 `skillId`

3. **Repository Note 綁定**
   - Input: `repoId: string`, `podId: string`
   - Action: `repositoryStore.bindToPod(repoId, podId)`
   - Mock WS: `REPOSITORY_BIND` → `REPOSITORY_BOUND`
   - 預期輸出:
     - Note 的 `boundToPodId` 設為 `podId`
     - Pod 的 `repositoryId` 設為 `repoId`

4. **SubAgent Note 綁定**
   - Input: `subAgentId: string`, `podId: string`
   - Action: `subAgentStore.bindToPod(subAgentId, podId)`
   - Mock WS: `SUB_AGENT_BIND` → `SUB_AGENT_BOUND`
   - 預期輸出:
     - Note 的 `boundToPodId` 設為 `podId`
     - Pod 的 `subAgentIds` 陣列增加 `subAgentId`

5. **Command Note 綁定**
   - Input: `commandId: string`, `podId: string`
   - Action: `commandStore.bindToPod(commandId, podId)`
   - Mock WS: `COMMAND_BIND` → `COMMAND_BOUND`
   - 預期輸出:
     - Note 的 `boundToPodId` 設為 `podId`
     - Pod 的 `commandId` 設為 `commandId`

**邊界情況**
- Note 已綁定到其他 Pod
- Pod 已綁定相同類型的 Note（OutputStyle/Repository/Command 只能綁定一個）
- Skill/SubAgent 綁定數量限制

---

### 1.5 建立 Pod 間連接

**涉及層級**
- Store: `connectionStore`
- Utils: `createWebSocketRequest`

**步驟**

1. **建立連接**
   - Input: `sourcePodId`, `sourceAnchor`, `targetPodId`, `targetAnchor`
   - Action: `connectionStore.createConnection(...)`
   - Mock WS: `CONNECTION_CREATE` → `CONNECTION_CREATED`
   - 預期輸出:
     - `connections` 陣列增加新連接
     - 預設 `triggerMode: 'auto'`, `status: 'idle'`

2. **連接驗證失敗**
   - 自我連接 (`sourcePodId === targetPodId`)
   - 重複連接（相同 source 和 target）
   - 預期輸出: 返回 `null`，顯示 Toast 警告

**邊界情況**
- 沒有 sourcePodId（從外部連接進來）
- 沒有啟用的 Canvas

---

### 1.6 設定連接 Trigger Mode

**涉及層級**
- Store: `connectionStore`
- Utils: `createWebSocketRequest`

**步驟**

1. **更新 Trigger Mode**
   - Input: `connectionId`, `triggerMode: 'auto' | 'ai-decide' | 'direct'`
   - Action: `connectionStore.updateConnectionTriggerMode(connectionId, triggerMode)`
   - Mock WS: `CONNECTION_UPDATE` → `CONNECTION_UPDATED`
   - 預期輸出:
     - 對應連接的 `triggerMode` 更新
     - 如切換到 `ai-decide`，`status` 重置為 `idle`

**邊界情況**
- 連接不存在
- 無效的 `triggerMode` 值

---

### 1.7 執行工作流（觸發上下游 Pod）

**涉及層級**
- Store: `connectionStore`, `chatStore`, `podStore`
- WebSocket Events: `WORKFLOW_AUTO_TRIGGERED`, `WORKFLOW_COMPLETE`, `WORKFLOW_AI_DECIDE_*`, `WORKFLOW_DIRECT_*`

**步驟**

1. **Auto Trigger 模式**
   - 觸發: Source Pod 對話完成
   - Mock WS: `WORKFLOW_AUTO_TRIGGERED` → `{targetPodId}`
   - Action: `connectionStore.handleWorkflowAutoTriggered(payload)`
   - 預期輸出:
     - 所有指向 `targetPodId` 且 `triggerMode === 'auto'` 的連接 `status` → `active`
     - Target Pod 開始執行（`podStore` 狀態更新）

2. **AI Decide 模式**
   - 觸發: Source Pod 對話完成
   - Mock WS:
     - `WORKFLOW_AI_DECIDE_PENDING` → `{connectionIds}`
     - `WORKFLOW_AI_DECIDE_RESULT` → `{connectionId, shouldTrigger, reason}`
   - Action:
     - `connectionStore.handleAiDecidePending(payload)` → 連接 `status` → `ai-deciding`
     - `connectionStore.handleAiDecideResult(payload)` → `status` → `ai-approved` 或 `ai-rejected`
   - 預期輸出:
     - 批准: 連接 `status` → `ai-approved`，Target Pod 開始執行
     - 拒絕: 連接 `status` → `ai-rejected`，`decideReason` 記錄原因

3. **Direct Trigger 模式**
   - 觸發: 用戶手動點擊連接
   - Mock WS: `WORKFLOW_DIRECT_TRIGGERED` → `{connectionId}`
   - Action: `connectionStore.handleWorkflowDirectTriggered(payload)`
   - 預期輸出:
     - 該連接 `status` → `active`
     - Target Pod 開始執行

4. **工作流完成**
   - Mock WS: `WORKFLOW_COMPLETE` → `{targetPodId, triggerMode, connectionId}`
   - Action: `connectionStore.handleWorkflowComplete(payload)`
   - 預期輸出:
     - Auto/AI-Decide: 所有指向 `targetPodId` 的連接 `status` → `idle`
     - Direct: 該連接 `status` → `idle`

5. **工作流排隊**
   - Mock WS: `WORKFLOW_QUEUED` → `{targetPodId, triggerMode, connectionId}`
   - Action: `connectionStore.handleWorkflowQueued(payload)`
   - 預期輸出:
     - 連接 `status` → `queued`

6. **排隊處理完成**
   - Mock WS: `WORKFLOW_QUEUE_PROCESSED` → `{targetPodId, triggerMode, connectionId}`
   - Action: `connectionStore.handleWorkflowQueueProcessed(payload)`
   - 預期輸出:
     - 連接 `status` → `active`

**邊界情況**
- Source Pod 沒有下游連接
- Target Pod 正在執行中（排隊機制）
- AI Decide 返回錯誤 (`WORKFLOW_AI_DECIDE_ERROR`)
- 連接被刪除時收到工作流事件

---

### 1.8 設定 Pod 排程

**涉及層級**
- Store: `podStore`
- Utils: `createWebSocketRequest`, `scheduleUtils`

**步驟**

1. **設定排程**
   - Input: `podId`, `schedule: Schedule`
   - Action: `podStore.setSchedule(podId, schedule)`
   - Mock WS: `POD_SCHEDULE_SET` → `POD_SCHEDULE_UPDATED`
   - 預期輸出:
     - Pod 的 `schedule` 欄位更新
     - `schedule.enabled` 為 `true`

2. **排程觸發動畫**
   - Mock WS: `SCHEDULE_FIRED` → `{podId}`
   - Action: `podStore` 更新 `scheduleFiredPodIds`
   - 預期輸出:
     - `scheduleFiredPodIds` 包含 `podId`
     - 動畫持續 3 秒後自動移除

**邊界情況**
- 無效的 `frequency` 或時間參數
- 排程被禁用 (`enabled: false`)

---

## Flow 2: Chat 對話流程

### 2.1 開啟 Pod 對話

**涉及層級**
- Store: `chatStore`, `podStore`

**步驟**

1. **選擇 Pod**
   - Input: `podId: string`
   - Action: `podStore.selectPod(podId)` 或 `podStore.setActivePod(podId)`
   - 預期輸出:
     - `selectedPodId` 或 `activePodId` 更新
     - 開啟對話介面

2. **檢查連接狀態**
   - Getter: `chatStore.isConnected`
   - 預期輸出: `connectionStatus === 'connected'`

**邊界情況**
- WebSocket 未連接（顯示重新連接提示）
- Pod 不存在

---

### 2.2 發送訊息

**涉及層級**
- Store: `chatStore`, `podStore`
- Utils: `generateRequestId`, `createWebSocketRequest`

**步驟**

1. **用戶輸入訊息**
   - Input: `podId: string`, `content: string`
   - Action: `chatStore.sendMessage(podId, content)`
   - Mock WS: `POD_CHAT_SEND` → 無即時回應，等待串流
   - 預期輸出:
     - `messagesByPodId.get(podId)` 增加 user 訊息
     - `isTypingByPodId.set(podId, true)`
     - Pod 狀態 → `chatting`

**邊界情況**
- 空白訊息
- WebSocket 未連接
- 正在串流中（防止重複發送）

---

### 2.3 串流接收回應

**涉及層級**
- Store: `chatStore`
- Actions: `chatMessageActions` (handleChatMessage, handleContentBlock)
- WebSocket Events: `POD_CHAT_MESSAGE`, `POD_CHAT_COMPLETE`

**步驟**

1. **接收串流開始**
   - Mock WS: `POD_CHAT_MESSAGE` → `{podId, isPartial: true, contentBlock: {...}}`
   - Action: `chatStore.handleChatMessage(payload)`
   - 預期輸出:
     - `messagesByPodId.get(podId)` 增加 assistant 訊息（`isPartial: true`）
     - `currentStreamingMessageId` 設為該訊息 ID
     - 累積內容長度記錄在 `accumulatedLengthByMessageId`

2. **接收串流片段（Delta）**
   - Mock WS: 持續發送 `POD_CHAT_MESSAGE` 事件
   - Action: 累積文字內容到現有訊息
   - 預期輸出:
     - 訊息內容持續增長
     - `isPartial: true` 保持不變

3. **接收串流結束**
   - Mock WS: `POD_CHAT_COMPLETE` → `{podId, messageId}`
   - Action: `chatStore.handleChatComplete(payload)`
   - 預期輸出:
     - 訊息 `isPartial` → `false`
     - `isTypingByPodId.set(podId, false)`
     - `currentStreamingMessageId` → `null`
     - Pod 狀態 → `idle`
     - `accumulatedLengthByMessageId` 清除該訊息記錄

**邊界情況**
- 串流中途中斷（收到 `POD_CHAT_ABORTED`）
- 收到錯誤事件 (`POD_ERROR`)
- 訊息 ID 不匹配

---

### 2.4 工具使用回應

**涉及層級**
- Store: `chatStore`
- Actions: `chatMessageActions` (handleToolUse, handleToolResult)
- WebSocket Events: `POD_CHAT_TOOL_USE`, `POD_CHAT_TOOL_RESULT`

**步驟**

1. **收到工具使用請求**
   - Mock WS: `POD_CHAT_TOOL_USE` → `{podId, messageId, toolUseId, toolName, input}`
   - Action: `chatStore.handleToolUse(payload)`
   - 預期輸出:
     - 訊息的 `toolUse` 陣列增加工具資訊
     - `status: 'running'`

2. **收到工具執行結果**
   - Mock WS: `POD_CHAT_TOOL_RESULT` → `{podId, messageId, toolUseId, output, status}`
   - Action: `chatStore.handleToolResult(payload)`
   - 預期輸出:
     - 對應工具的 `output` 更新
     - `status` → `'completed'` 或 `'error'`

**邊界情況**
- 工具執行失敗 (`status: 'error'`)
- 訊息或工具 ID 不存在

---

### 2.5 對話完成

**涉及層級**
- Store: `chatStore`, `connectionStore`, `podStore`
- WebSocket Events: `POD_CHAT_COMPLETE`, `WORKFLOW_AUTO_TRIGGERED`

**步驟**

1. **對話結束，觸發工作流**
   - Mock WS: `POD_CHAT_COMPLETE` → `{podId}`
   - Action: `chatStore.handleChatComplete(payload)`
   - 預期輸出:
     - Pod 狀態 → `idle`
     - 檢查下游連接，觸發工作流
     - 如有 auto 連接，收到 `WORKFLOW_AUTO_TRIGGERED`

2. **AutoClear 機制**
   - 條件: Pod 的 `autoClear: true`
   - Mock WS: `POD_MESSAGES_CLEARED` → `{podId}`
   - Action: `chatStore.handleMessagesClearedEvent(payload)`
   - 預期輸出:
     - `messagesByPodId.get(podId)` 清空
     - `autoClearAnimationPodId` 設為 `podId`，3 秒後清除
     - Pod 的 `output` 陣列清空

**邊界情況**
- Pod 沒有下游連接
- AutoClear 被禁用

---

### 2.6 歷史訊息載入

**涉及層級**
- Store: `chatStore`
- Actions: `chatHistoryActions` (loadHistory, loadMoreHistory)
- Utils: `createWebSocketRequest`

**步驟**

1. **初次載入歷史**
   - Input: `podId: string`
   - Action: `chatStore.loadHistory(podId)`
   - Mock WS: `POD_CHAT_HISTORY_LOAD` → `POD_CHAT_HISTORY_LOADED`
   - 預期輸出:
     - `historyLoadingStatus.set(podId, 'loading')`
     - `messagesByPodId.set(podId, messages)`
     - `historyLoadingStatus.set(podId, 'loaded')`

2. **載入更多歷史**
   - Input: `podId: string`, `before: string` (最早訊息 ID)
   - Action: `chatStore.loadMoreHistory(podId, before)`
   - Mock WS: `POD_CHAT_HISTORY_LOAD` → `POD_CHAT_HISTORY_LOADED`
   - 預期輸出:
     - 舊訊息插入到陣列開頭
     - 如回傳訊息數 < 預期，`allHistoryLoaded` → `true`

**邊界情況**
- 沒有歷史訊息（回傳空陣列）
- 載入失敗 (`historyLoadingStatus` → `error`)
- 重複載入請求（防止並發）

---

### 2.7 中止對話

**涉及層級**
- Store: `chatStore`
- Utils: `createWebSocketRequest`

**步驟**

1. **用戶中止**
   - Input: `podId: string`
   - Action: `chatStore.abortChat(podId)`
   - Mock WS: `POD_CHAT_ABORT` → `POD_CHAT_ABORTED`
   - 預期輸出:
     - 串流立即停止
     - `isTypingByPodId.set(podId, false)`
     - 當前訊息保留（可能是部分內容）
     - Pod 狀態 → `idle`

**邊界情況**
- 沒有正在進行的對話
- 中止請求失敗

---

## Flow 3: 複製貼上/批量操作

### 3.1 框選多個元素

**涉及層級**
- Store: `selectionStore`, `podStore`, 各類 `noteStore`
- Composables: `useBoxSelect`

**步驟**

1. **開始框選**
   - Input: `startX: number`, `startY: number`, `isCtrlPressed: boolean`
   - Action: `selectionStore.startSelection(startX, startY, isCtrlPressed)`
   - 預期輸出:
     - `isSelecting` → `true`
     - `box` 設定初始座標
     - `isCtrlMode` 根據 Ctrl 鍵設定
     - 如 Ctrl 按下，保存 `initialSelectedElements`

2. **更新框選範圍**
   - Input: `endX: number`, `endY: number`
   - Action: `selectionStore.updateSelection(endX, endY)`
   - 預期輸出:
     - `box.endX`, `box.endY` 更新

3. **計算選中元素**
   - Action: `selectionStore.calculateSelectedElements(pods, notes...)`
   - 邏輯:
     - 計算框選範圍 (`minX, maxX, minY, maxY`)
     - 檢查 Pod 是否相交（基於 `POD_WIDTH`, `POD_HEIGHT`）
     - 檢查 Note 是否相交（基於 `NOTE_WIDTH`, `NOTE_HEIGHT`）
     - 排除已綁定的 Note (`boundToPodId !== null`)
   - 預期輸出:
     - `selectedElements` 陣列更新
     - Ctrl 模式: 與 `initialSelectedElements` 做 Toggle 運算

4. **結束框選**
   - Action: `selectionStore.endSelection()`
   - 預期輸出:
     - `isSelecting` → `false`
     - `box` → `null`
     - `boxSelectJustEnded` → `true`（下一幀後重置）

**邊界情況**
- 框選範圍為空（未選中任何元素）
- Ctrl 模式下反選已選元素
- 框選時移出畫布範圍

---

### 3.2 Ctrl+C 複製

**涉及層級**
- Store: `clipboardStore`, `selectionStore`, `podStore`, `connectionStore`, 各類 `noteStore`
- Composables: `useCopyPaste`

**步驟**

1. **複製選中元素**
   - Input: 來自 `selectionStore.selectedElements`
   - Action: `clipboardStore.setCopy(pods, notes, connections)`
   - 邏輯:
     - 從 `selectionStore` 取得選中的 Pod/Note IDs
     - 從各 Store 取得完整資料
     - 複製相關連接（source 和 target 都在選中範圍內）
     - 計算相對位置（以選中元素的中心為基準）
   - 預期輸出:
     - `clipboardStore` 狀態更新:
       - `copiedPods`, `copiedOutputStyleNotes`, `copiedSkillNotes`, `copiedRepositoryNotes`, `copiedSubAgentNotes`, `copiedCommandNotes`, `copiedConnections`
       - `copyTimestamp` 設為當前時間

**邊界情況**
- 沒有選中任何元素
- 複製已綁定的 Note（需解除綁定關係）
- 複製跨 Canvas 的連接

---

### 3.3 Ctrl+V 貼上

**涉及層級**
- Store: `clipboardStore`, `podStore`, `connectionStore`, 各類 `noteStore`, `canvasStore`
- Composables: `useCopyPaste`
- Utils: `createWebSocketRequest`

**步驟**

1. **檢查剪貼簿**
   - Getter: `clipboardStore.isEmpty`
   - 預期輸出: 如為空，不執行貼上

2. **計算貼上位置**
   - Input: 滑鼠座標或預設偏移量
   - 邏輯: 相對於原始位置偏移（避免完全重疊）

3. **建立 Pod 副本**
   - Action: 對每個 `copiedPod` 呼叫 `podStore.createPodWithBackend(...)`
   - Mock WS: `POD_CREATE` → `POD_CREATED`
   - 預期輸出:
     - 新 Pod 加入 `pods` 陣列
     - 建立 ID 映射 (`oldPodId` → `newPodId`)

4. **建立 Note 副本**
   - Action: 對每個 Note 呼叫對應 Store 的 `create()` 方法
   - Mock WS: 各類 `*_CREATE` → `*_CREATED`
   - 預期輸出:
     - 新 Note 加入對應 Store
     - 建立 ID 映射 (`oldNoteId` → `newNoteId`)
     - 如 Note 原本有 `boundToPodId`，更新為新 Pod ID

5. **重建連接**
   - Action: 對每個 `copiedConnection` 呼叫 `connectionStore.createConnection(...)`
   - 邏輯: 使用新的 Pod ID
   - Mock WS: `CONNECTION_CREATE` → `CONNECTION_CREATED`
   - 預期輸出:
     - 新連接加入 `connections` 陣列
     - 保留原始的 `triggerMode`

**邊界情況**
- 貼上時沒有啟用的 Canvas
- 部分 Pod/Note 建立失敗（容錯處理）
- 貼上位置超出畫布範圍

---

### 3.4 批量拖曳移動

**涉及層級**
- Store: `selectionStore`, `podStore`, `viewportStore`, 各類 `noteStore`
- Composables: `useBatchDrag`

**步驟**

1. **開始批量拖曳**
   - Input: 滑鼠按下選中元素
   - Action: 記錄初始座標 (`dragStartX`, `dragStartY`)
   - 預期輸出:
     - 進入拖曳模式

2. **拖曳過程**
   - Input: 滑鼠移動 (`deltaX`, `deltaY`)
   - Action: 更新所有選中元素的座標
   - 邏輯:
     - 遍歷 `selectionStore.selectedPodIds`，更新 `podStore` 中的 `x`, `y`
     - 遍歷各類 Note IDs，更新對應 Store 中的 `x`, `y`
   - 預期輸出:
     - 元素位置即時更新（本地狀態）

3. **結束拖曳（同步到後端）**
   - Action: 對所有移動的元素呼叫 `move()` 方法
   - Mock WS: `POD_MOVE`, `*_NOTE_MOVE` → 對應回應
   - 預期輸出:
     - 後端同步完成
     - 如失敗，回滾到原始位置

**邊界情況**
- 拖曳到畫布外（限制座標範圍）
- 拖曳中切換 Canvas（取消操作）
- 網路延遲導致同步失敗

---

### 3.5 批量刪除

**涉及層級**
- Store: `selectionStore`, `podStore`, `connectionStore`, 各類 `noteStore`
- Composables: `useDeleteSelection`
- Utils: `createWebSocketRequest`

**步驟**

1. **刪除選中元素**
   - Input: 來自 `selectionStore.selectedElements`
   - Action: `deleteSelection()`
   - 邏輯:
     - 刪除所有選中的 Pod: `podStore.deletePodWithBackend(podId)`
     - 刪除相關連接: `connectionStore.deleteConnectionsByPodId(podId)`
     - 刪除所有選中的 Note: 各 Store 的 `delete(noteId)`
   - Mock WS: `POD_DELETE`, `CONNECTION_DELETE`, `*_NOTE_DELETE` → 對應回應
   - 預期輸出:
     - 元素從各 Store 移除
     - `selectionStore.clearSelection()`
     - Toast 顯示「已刪除 X 個元素」

**邊界情況**
- 刪除正在對話中的 Pod（需先中止對話）
- 刪除有下游連接的 Pod（級聯刪除連接）
- 部分刪除失敗（容錯處理）

---

### 3.6 撤銷（Undo）

**涉及層級**
- Store: 各核心 Store（需實作歷史記錄機制）
- Composables: `useUndo` (需實作)

**步驟**

1. **記錄操作歷史**
   - 機制: 在關鍵操作前儲存狀態快照
   - 操作類型:
     - 建立/刪除 Pod/Note
     - 移動元素
     - 建立/刪除連接
     - 複製貼上

2. **執行撤銷**
   - Input: `Ctrl+Z`
   - Action: `undo()`
   - 邏輯:
     - 從歷史堆疊取出上一個狀態
     - 還原各 Store 的資料
     - 同步到後端（批量操作）
   - Mock WS: 對應的反向操作（刪除變建立，建立變刪除等）
   - 預期輸出:
     - 狀態回滾到上一步

**邊界情況**
- 沒有可撤銷的操作
- 撤銷後狀態與後端不一致（需重新同步）
- 跨 Canvas 的撤銷

---

## 測試覆蓋範圍總結

### Flow 1 測試點（18 個）
1. 建立 Canvas 成功/失敗
2. 建立 Pod 成功/失敗/驗證失敗
3. 設定 Pod Model 成功/失敗
4. 綁定 5 種 Note 類型（成功/失敗/邊界情況）
5. 建立連接成功/自我連接/重複連接
6. 更新連接 Trigger Mode
7. 工作流觸發（Auto/AI-Decide/Direct）
8. 工作流完成/排隊
9. 設定排程成功/觸發動畫

### Flow 2 測試點（15 個）
1. 開啟對話（選擇 Pod/檢查連接）
2. 發送訊息成功/失敗
3. 串流接收（開始/片段/結束）
4. 工具使用（請求/結果/錯誤）
5. 對話完成（觸發工作流/AutoClear）
6. 載入歷史訊息（初次/載入更多/失敗）
7. 中止對話

### Flow 3 測試點（12 個）
1. 框選（開始/更新/計算/結束/Ctrl 模式）
2. 複製選中元素（含連接）
3. 貼上（Pod/Note/連接重建）
4. 批量拖曳（開始/過程/結束同步）
5. 批量刪除（Pod/Note/連接級聯）
6. 撤銷操作

**總計: 45+ 測試場景**

---

## Mock 策略

### WebSocket Mock
使用 `vi.mock('@/services/websocket')` 模擬:
- `createWebSocketRequest`: 返回預定義的成功/失敗回應
- `websocketClient.on/off/emit`: 觸發事件監聽器

### 測試工具
- **Vitest**: 單元測試框架
- **@pinia/testing**: Pinia Store 測試工具
- **@vue/test-utils**: Vue Composables 測試（如需要）

### 測試資料工廠
建立 `factories/` 目錄，提供:
- `createMockCanvas()`
- `createMockPod()`
- `createMockNote()`
- `createMockConnection()`
- `createMockMessage()`
