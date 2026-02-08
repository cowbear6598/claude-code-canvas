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

> ✅ **已完成** — vitest.config.ts, setup.ts, package.json scripts 均已設定

---

## 2. Mock 與 Factory 設計

> ✅ **已完成** — mockWebSocket.ts, factories.ts, mockStoreFactory.ts 均已建立

---

## 3. Phase 1：基礎設施 + Utils 測試

> ✅ **Phase 1 已完成** — 9 個測試檔、145 個測試全部通過
>
> 完成項目：gitUrlParser, scheduleUtils, errorSanitizer, keyboardHelpers, domHelpers, sanitize, WebSocketClient, createWebSocketRequest, example

---

## 4. Phase 2：Core Stores 測試

> ✅ **Phase 2 已完成** — 6 個測試檔、338 個測試全部通過
>
> 完成項目：canvasStore, podStore, connectionStore, selectionStore, viewportStore, clipboardStore
>
> 重構完成：提取 isValidPod/enrichPod 到 src/lib/podValidation.ts

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
