# Slack 整合前端計畫書

> 專案：Vue3 + TypeScript + Pinia + Tailwind CSS + Shadcn UI
> 日期：2026-03-02
> 測試指令：`bun run test`
> 風格檢查：`bun run style`

---

## 測試案例定義

### slackStore 測試
- 應正確初始化空的 Slack App 列表
- 應能新增 Slack App 到列表
- 應能刪除 Slack App
- 應能更新 Slack App 連線狀態
- 應能更新 Slack App 的頻道列表
- 應能根據 App ID 查找 App
- 應能根據 Pod ID 查找綁定的 Slack 資訊
- `createSlackApp` 成功時應新增 App 並 toast 成功
- `createSlackApp` 失敗時應 toast 錯誤
- `deleteSlackApp` 成功時應移除 App 並 toast 成功
- `deleteSlackApp` 失敗時應 toast 錯誤
- `bindSlackToPod` 成功時應更新 Pod 的 Slack 綁定
- `unbindSlackFromPod` 成功時應清除 Pod 的 Slack 綁定
- `loadSlackApps` 應從後端載入 App 列表

### SlackAppsModal 測試
- 應渲染 Modal 標題
- 應列出所有已註冊的 Slack App
- 應顯示每個 App 的連線狀態指示燈
- 應顯示每個 App 的可用頻道列表
- 點擊新增按鈕應展開新增表單
- 新增表單應驗證 Bot Token 格式（xoxb- 開頭）
- 新增表單應驗證 App-Level Token 格式（xapp- 開頭）
- 格式不正確時確認按鈕應為 disabled
- 提交新增後應呼叫 slackStore.createSlackApp
- 點擊刪除按鈕應呼叫 slackStore.deleteSlackApp

### SlackConnectModal 測試
- 應渲染 Modal 標題
- 應列出所有已註冊的 Slack App
- 選擇 App 後應顯示該 App 的頻道列表
- 未選擇頻道時確認按鈕應為 disabled
- 提交後應呼叫 slackStore.bindSlackToPod
- 已綁定的 Pod 開啟時應預選目前綁定的 App 和頻道

### SlackStatusIcon 測試
- 已連線時應顯示綠色 Slack Icon
- 已斷線時應顯示紅色 Slack Icon
- 未綁定 Slack 時不應渲染

### PodContextMenu 測試（修改）
- 未綁定 Slack 時應顯示「連接 Slack」選項
- 已綁定 Slack 時應顯示「斷開 Slack」選項
- 點擊「斷開 Slack」應呼叫 slackStore.unbindSlackFromPod

### WebSocket 事件監聽測試
- 收到 SLACK_APP_CREATED 事件應新增 App 到 slackStore
- 收到 SLACK_APP_DELETED 事件應從 slackStore 移除 App
- 收到 SLACK_CONNECTION_STATUS_CHANGED 事件應更新 App 連線狀態
- 收到 POD_SLACK_BOUND 事件應更新 Pod 的 Slack 綁定
- 收到 POD_SLACK_UNBOUND 事件應清除 Pod 的 Slack 綁定

---

## 執行順序總覽

1. Phase 1 - 型別定義（無 UI 變動，純型別）
2. Phase 2 - WebSocket 事件定義（擴充 events.ts）
3. Phase 3 - slackStore（核心狀態管理）
4. Phase 4 - WebSocket 事件監聽（接收後端推送）
5. Phase 5 - SlackAppsModal 元件（管理 Modal）
6. Phase 6 - SlackConnectModal 元件（Pod 綁定 Modal）
7. Phase 7 - SlackStatusIcon 元件（Pod 狀態指示）
8. Phase 8 - 修改既有元件（Header、PodContextMenu、CanvasPod、CanvasContainer）
9. Phase 9 - App 初始化整合（App.vue 載入 Slack 資料）

每個 Phase 完成後都必須執行 `bun run test` 和 `bun run style` 確認無破壞。

---

## Phase 1：型別定義

影響檔案：
- `frontend/src/types/slack.ts`（新建）
- `frontend/src/types/pod.ts`
- `frontend/src/types/index.ts`

### 1-1：建立 Slack 型別檔案

- [x] 建立 `frontend/src/types/slack.ts`
- [x] 定義 `SlackAppConnectionStatus` 型別
  - 聯合型別：`'connected' | 'disconnected' | 'connecting'`
- [x] 定義 `SlackChannel` 介面
  - `id: string` - Slack 頻道 ID（例如 C0xxxxxxx）
  - `name: string` - 頻道名稱（例如 #general）
- [x] 定義 `SlackApp` 介面
  - `id: string` - App UUID（後端產生）
  - `name: string` - 使用者自訂的 App 名稱
  - `connectionStatus: SlackAppConnectionStatus` - 連線狀態
  - `channels: SlackChannel[]` - Bot 已加入的頻道清單
- [x] 定義 `PodSlackBinding` 介面
  - `slackAppId: string` - 綁定的 Slack App ID
  - `slackChannelId: string` - 綁定的單一頻道 ID

### 1-2：修改 Pod 型別

- [x] 修改 `frontend/src/types/pod.ts`
- [x] 在 `Pod` 介面新增欄位
  - `slackBinding?: PodSlackBinding | null` - Slack 綁定資訊，未綁定時為 null 或 undefined
- [x] 在檔案頂部 import `PodSlackBinding` 型別

### 1-3：匯出 Slack 型別

- [x] 修改 `frontend/src/types/index.ts`
- [x] 新增 `export * from './slack'`

---

## Phase 2：WebSocket 事件定義

影響檔案：
- `frontend/src/types/websocket/events.ts`
- `frontend/src/types/websocket/requests.ts`
- `frontend/src/types/websocket/responses.ts`

### 2-1：新增 WebSocket Request 事件

- [x] 修改 `frontend/src/types/websocket/events.ts`
- [x] 在 `WebSocketRequestEvents` 物件新增以下事件常數：
  - `SLACK_APP_CREATE: 'slack:app:create'`
  - `SLACK_APP_DELETE: 'slack:app:delete'`
  - `SLACK_APP_LIST: 'slack:app:list'`
  - `SLACK_APP_GET: 'slack:app:get'`
  - `SLACK_APP_CHANNELS: 'slack:app:channels'`
  - `SLACK_APP_CHANNELS_REFRESH: 'slack:app:channels:refresh'`
  - `POD_BIND_SLACK: 'pod:bind-slack'`
  - `POD_UNBIND_SLACK: 'pod:unbind-slack'`

### 2-2：新增 WebSocket Response 事件

- [x] 在 `WebSocketResponseEvents` 物件新增以下事件常數：
  - `SLACK_APP_CREATED: 'slack:app:created'`
  - `SLACK_APP_DELETED: 'slack:app:deleted'`
  - `SLACK_APP_LIST_RESULT: 'slack:app:list:result'`
  - `SLACK_APP_GET_RESULT: 'slack:app:get:result'`
  - `SLACK_APP_CHANNELS_RESULT: 'slack:app:channels:result'`
  - `SLACK_APP_CHANNELS_REFRESHED: 'slack:app:channels:refreshed'`
  - `POD_SLACK_BOUND: 'pod:slack:bound'`
  - `POD_SLACK_UNBOUND: 'pod:slack:unbound'`
  - `SLACK_CONNECTION_STATUS_CHANGED: 'slack:connection:status:changed'`（push）
  - `SLACK_MESSAGE_RECEIVED: 'slack:message:received'`（push）
  - `SLACK_MESSAGE_QUEUED: 'slack:message:queued'`（push）

### 2-3：新增 Request Payload 型別

- [x] 修改 `frontend/src/types/websocket/requests.ts`
- [x] 定義 `SlackAppCreatePayload`
  - `requestId: string`
  - `name: string` - 自訂名稱
  - `botToken: string` - Slack Bot Token（xoxb- 開頭）
  - `appLevelToken: string` - Slack App-Level Token（xapp- 開頭）
- [x] 定義 `SlackAppDeletePayload`
  - `requestId: string`
  - `slackAppId: string`
- [x] 定義 `SlackAppListPayload`
  - `requestId: string`
- [x] 定義 `SlackAppGetPayload`
  - `requestId: string`
  - `slackAppId: string`
- [x] 定義 `SlackAppChannelsPayload`
  - `requestId: string`
  - `slackAppId: string`
- [x] 定義 `SlackAppChannelsRefreshPayload`
  - `requestId: string`
  - `slackAppId: string`
- [x] 定義 `PodBindSlackPayload`
  - `requestId: string`
  - `canvasId: string`
  - `podId: string`
  - `slackAppId: string`
  - `slackChannelId: string`
- [x] 定義 `PodUnbindSlackPayload`
  - `requestId: string`
  - `canvasId: string`
  - `podId: string`

### 2-4：新增 Response Payload 型別

- [x] 修改 `frontend/src/types/websocket/responses.ts`
- [x] 定義 `SlackAppCreatedPayload`
  - `requestId: string`
  - `success: boolean`
  - `slackApp?: SlackApp` - 成功時回傳完整的 SlackApp 物件（含 connectionStatus 和 channels）
  - `error?: string`
- [x] 定義 `SlackAppDeletedPayload`
  - `requestId: string`
  - `success: boolean`
  - `slackAppId?: string`
  - `error?: string`
- [x] 定義 `SlackAppListResultPayload`
  - `requestId: string`
  - `success: boolean`
  - `slackApps?: SlackApp[]`
  - `error?: string`
- [x] 定義 `SlackAppGetResultPayload`
  - `requestId: string`
  - `success: boolean`
  - `slackApp?: SlackApp`
  - `error?: string`
- [x] 定義 `SlackAppChannelsResultPayload`
  - `requestId: string`
  - `success: boolean`
  - `channels?: SlackChannel[]`
  - `error?: string`
- [x] 定義 `SlackAppChannelsRefreshedPayload`
  - `requestId: string`
  - `success: boolean`
  - `channels?: SlackChannel[]`
  - `error?: string`
- [x] 定義 `SlackConnectionStatusChangedPayload`
  - `slackAppId: string`
  - `connectionStatus: SlackAppConnectionStatus`
  - `channels?: SlackChannel[]` - 重連後可能更新頻道列表
- [x] 定義 `PodSlackBoundPayload`
  - `requestId: string`
  - `canvasId: string`
  - `success: boolean`
  - `pod?: Pod`
  - `error?: string`
- [x] 定義 `PodSlackUnboundPayload`
  - `requestId: string`
  - `canvasId: string`
  - `success: boolean`
  - `pod?: Pod`
  - `error?: string`

---

## Phase 3：slackStore

影響檔案：
- `frontend/src/stores/slackStore.ts`（新建）
- `frontend/src/stores/index.ts`
- `frontend/src/composables/canvas/useCanvasContext.ts`

### 3-1：建立 slackStore

- [ ] 建立 `frontend/src/stores/slackStore.ts`
- [ ] 使用 `defineStore('slack', { ... })` 定義 store
- [ ] State 定義：
  - `slackApps: SlackApp[]` - 所有已註冊的 Slack App 列表
- [ ] Getters 定義：
  - `getSlackAppById: (id: string) => SlackApp | undefined` - 根據 ID 查找 App
  - `connectedApps: SlackApp[]` - 只回傳 connectionStatus 為 'connected' 的 App
  - `getSlackAppForPod: (pod: Pod) => SlackApp | undefined` - 根據 Pod 的 slackBinding.slackAppId 查找 App
- [ ] Actions 定義：
  - `async loadSlackApps(): Promise<void>` - 透過 `createWebSocketRequest` 發送 `SLACK_APP_LIST` 取得列表，更新 `slackApps`
  - `async createSlackApp(name: string, botToken: string, appLevelToken: string): Promise<SlackApp | null>` - 發送 `SLACK_APP_CREATE`，成功時 toast 成功訊息
  - `async deleteSlackApp(slackAppId: string): Promise<void>` - 發送 `SLACK_APP_DELETE`，成功時 toast 成功訊息
  - `async bindSlackToPod(podId: string, slackAppId: string, channelId: string): Promise<void>` - 發送 `POD_BIND_SLACK`，需要 canvasId（透過 `requireActiveCanvas()` 取得）
  - `async unbindSlackFromPod(podId: string): Promise<void>` - 發送 `POD_UNBIND_SLACK`，需要 canvasId
  - `addSlackAppFromEvent(slackApp: SlackApp): void` - 從 WebSocket 事件新增 App
  - `removeSlackAppFromEvent(slackAppId: string): void` - 從 WebSocket 事件移除 App
  - `updateSlackAppStatus(slackAppId: string, connectionStatus: SlackAppConnectionStatus, channels?: SlackChannel[]): void` - 從 WebSocket 事件更新 App 連線狀態
- [ ] 錯誤處理：所有 async action 使用 `useToast` 的 `showSuccessToast` / `showErrorToast` 顯示結果，錯誤訊息使用 `sanitizeErrorForUser`

### 3-2：匯出 slackStore

- [ ] 修改 `frontend/src/stores/index.ts`
- [ ] 新增 `export { useSlackStore } from './slackStore'`

### 3-3：加入 useCanvasContext

- [ ] 修改 `frontend/src/composables/canvas/useCanvasContext.ts`
- [ ] import `useSlackStore`
- [ ] 在函式內呼叫 `const slackStore = useSlackStore()`
- [ ] 在回傳型別和回傳值中新增 `slackStore`

---

## Phase 4：WebSocket 事件監聽

影響檔案：
- `frontend/src/composables/useUnifiedEventListeners.ts`

### 4-1：新增 Slack 相關事件處理器

- [ ] 修改 `frontend/src/composables/useUnifiedEventListeners.ts`
- [ ] 在檔案頂部 import `useSlackStore`
- [ ] 新增 `handleSlackAppCreated` 處理器
  - 使用 `createUnifiedHandler`，`skipCanvasCheck: true`（Slack App 不隸屬於特定 Canvas）
  - payload 含 `slackApp?: SlackApp`
  - 呼叫 `useSlackStore().addSlackAppFromEvent(payload.slackApp)`
- [ ] 新增 `handleSlackAppDeleted` 處理器
  - 使用 `createUnifiedHandler`，`skipCanvasCheck: true`
  - payload 含 `slackAppId: string`
  - 呼叫 `useSlackStore().removeSlackAppFromEvent(payload.slackAppId)`
- [ ] 新增 `handleSlackConnectionStatusChanged` 處理器
  - 直接註冊（不使用 `createUnifiedHandler`，因為此事件無 requestId）
  - payload 含 `slackAppId: string`、`connectionStatus: SlackAppConnectionStatus`、`channels?: SlackChannel[]`
  - 呼叫 `useSlackStore().updateSlackAppStatus(payload.slackAppId, payload.connectionStatus, payload.channels)`
- [ ] 新增 `handleSlackMessageReceived` 處理器
  - 直接註冊（不使用 `createUnifiedHandler`，因為此事件無 requestId）
  - 收到後透過 toast 提示使用者有 Slack 訊息進入 Pod
- [ ] 新增 `handleSlackMessageQueued` 處理器
  - 直接註冊（不使用 `createUnifiedHandler`，因為此事件無 requestId）
  - 收到後透過 toast 提示使用者訊息已排隊
- [ ] 新增 `handlePodSlackBound` 處理器
  - 使用 `createUnifiedHandler`
  - payload 含 `pod?: Pod`、`canvasId: string`
  - 呼叫 `usePodStore().updatePod(payload.pod)`
- [ ] 新增 `handlePodSlackUnbound` 處理器
  - 使用 `createUnifiedHandler`
  - payload 含 `pod?: Pod`、`canvasId: string`
  - 呼叫 `usePodStore().updatePod(payload.pod)`

### 4-2：註冊事件監聽

- [ ] 在 `listeners` 陣列新增以下項目：
  - `{ event: WebSocketResponseEvents.SLACK_APP_CREATED, handler: handleSlackAppCreated }`
  - `{ event: WebSocketResponseEvents.SLACK_APP_DELETED, handler: handleSlackAppDeleted }`
  - `{ event: WebSocketResponseEvents.POD_SLACK_BOUND, handler: handlePodSlackBound }`
  - `{ event: WebSocketResponseEvents.POD_SLACK_UNBOUND, handler: handlePodSlackUnbound }`
- [ ] `handleSlackConnectionStatusChanged`、`handleSlackMessageReceived`、`handleSlackMessageQueued` 因為沒有 requestId，需要在 `registerUnifiedListeners` 中手動以 `websocketClient.on` 註冊，在 `unregisterUnifiedListeners` 中以 `websocketClient.off` 取消註冊（參考 `handlePodChatUserMessage` 的做法）

---

## Phase 5：SlackAppsModal 元件

影響檔案：
- `frontend/src/components/slack/SlackAppsModal.vue`（新建）

### 5-1：建立 SlackAppsModal 元件

- [ ] 建立目錄 `frontend/src/components/slack/`
- [ ] 建立 `frontend/src/components/slack/SlackAppsModal.vue`
- [ ] Props：
  - `open: boolean` - 控制 Modal 顯示
- [ ] Emits：
  - `update:open: [value: boolean]` - 關閉 Modal

### 5-2：實作 Modal 結構

- [ ] 使用 Shadcn UI 的 `Dialog`、`DialogContent`、`DialogHeader`、`DialogTitle`、`DialogDescription`、`DialogFooter` 元件
- [ ] Modal 標題：「Slack Apps 管理」
- [ ] Modal 描述：「管理已註冊的 Slack App 與連線狀態」
- [ ] Modal 寬度：`max-w-2xl`

### 5-3：實作 App 列表區域

- [ ] 使用 `slackStore.slackApps` 渲染列表
- [ ] 每個 App 顯示：
  - 連線狀態指示燈（圓點）
    - `connected` -> `bg-green-500`
    - `disconnected` -> `bg-red-500`
    - `connecting` -> `bg-yellow-500` 搭配 pulse 動畫
  - App 名稱（粗體）
  - 頻道列表（以 tag 形式顯示，例如灰底圓角小標籤 `#general`、`#random`）
  - 刪除按鈕（`Trash2` icon，右側對齊）
- [ ] 空狀態：列表為空時顯示「尚未註冊任何 Slack App」提示文字

### 5-4：實作新增 App 表單

- [ ] 新增一個 `showAddForm: ref<boolean>` 控制表單顯示
- [ ] 列表區域底部放置「新增 App」按鈕（`Plus` icon）
- [ ] 點擊後展開表單，包含以下欄位：
  - App 名稱：`Input` 元件，placeholder 為「例如：My Slack Bot」
  - Bot Token：`Input` 元件，type 為 password，placeholder 為「xoxb-...」
  - App-Level Token：`Input` 元件，type 為 password，placeholder 為「xapp-...」
- [ ] 即時驗證邏輯：
  - 名稱不可為空
  - Bot Token 必須以 `xoxb-` 開頭
  - App-Level Token 必須以 `xapp-` 開頭
  - 任一驗證不通過時顯示紅色錯誤文字，且確認按鈕 disabled
- [ ] 表單底部有「取消」和「確認新增」按鈕
- [ ] 點擊「確認新增」後：
  - 按鈕變為 loading 狀態（disabled + 文字改為「連線中...」）
  - 呼叫 `slackStore.createSlackApp(name, botToken, appLevelToken)`
  - 成功後收起表單、重設欄位
  - 失敗則顯示錯誤訊息（slackStore 內部已處理 toast）

### 5-5：實作刪除 App

- [ ] 點擊刪除按鈕時呼叫 `slackStore.deleteSlackApp(app.id)`
- [ ] 不需要額外的確認 Dialog（App 列表變動即可看到效果）

---

## Phase 6：SlackConnectModal 元件

影響檔案：
- `frontend/src/components/slack/SlackConnectModal.vue`（新建）

### 6-1：建立 SlackConnectModal 元件

- [ ] 建立 `frontend/src/components/slack/SlackConnectModal.vue`
- [ ] Props：
  - `open: boolean`
  - `podId: string` - 要綁定的 Pod ID
- [ ] Emits：
  - `update:open: [value: boolean]`

### 6-2：實作 Modal 結構

- [ ] 使用 Shadcn UI Dialog 系列元件
- [ ] Modal 標題：「連接 Slack」
- [ ] Modal 寬度：`max-w-lg`

### 6-3：實作 App 選擇

- [ ] 使用 Shadcn UI 的 `RadioGroup` + `RadioGroupItem` 列出所有 Slack App
- [ ] 每個選項顯示：
  - 連線狀態指示燈
  - App 名稱
- [ ] 定義 `selectedAppId: ref<string | null>` 追蹤選擇

### 6-4：實作頻道選擇

- [ ] 選擇 App 後，下方顯示該 App 的頻道列表
- [ ] 使用 `RadioGroup` + `RadioGroupItem` 元件讓使用者單選頻道
- [ ] 定義 `selectedChannelId: ref<string | null>` 追蹤選擇
- [ ] 切換 App 時重設 `selectedChannelId`

### 6-5：實作已綁定狀態預填

- [ ] 元件掛載時（watch `open` 變為 true），檢查 Pod 是否已有 `slackBinding`
- [ ] 若已綁定：
  - 預選 `slackBinding.slackAppId` 對應的 App
  - 預選 `slackBinding.slackChannelId` 對應的頻道
- [ ] 若未綁定：清除所有選擇

### 6-6：實作確認與取消

- [ ] 確認按鈕在以下條件下 disabled：
  - 未選擇任何 App
  - 未選擇任何頻道
- [ ] 點擊確認後呼叫 `slackStore.bindSlackToPod(podId, selectedAppId, selectedChannelId)`，然後關閉 Modal
- [ ] 點擊取消關閉 Modal

### 6-7：無 App 時的空狀態

- [ ] 若 `slackStore.slackApps` 為空，顯示提示文字「尚未有可用的 Slack App，請先前往管理介面新增」
- [ ] 確認按鈕為 disabled

---

## Phase 7：SlackStatusIcon 元件

影響檔案：
- `frontend/src/components/pod/SlackStatusIcon.vue`（新建）

### 7-1：建立 SlackStatusIcon 元件

- [ ] 建立 `frontend/src/components/pod/SlackStatusIcon.vue`
- [ ] Props：
  - `slackBinding: PodSlackBinding | null | undefined` - Pod 的 Slack 綁定資訊
- [ ] 元件不定義 emits

### 7-2：實作渲染邏輯

- [ ] 若 `slackBinding` 為 null 或 undefined，不渲染任何內容（使用 `v-if`）
- [ ] 從 `useSlackStore` 取得對應 App 的連線狀態
- [ ] 使用 lucide-vue-next 的 `MessageSquare` icon（或自訂 Slack SVG icon）
- [ ] 樣式：
  - 定位：`absolute` 定位於 Pod 卡片右上角，`top: -8px`、`right: -8px`
  - 大小：20x20px
  - 背景色：
    - App connectionStatus 為 `connected` -> `bg-green-500`
    - App connectionStatus 為 `disconnected` -> `bg-red-500`
    - App connectionStatus 為 `connecting` -> `bg-yellow-500`
    - 找不到 App（App 被刪除） -> `bg-gray-400`
  - 圓角：`rounded-full`
  - Icon 顏色：`text-white`
  - Icon 大小：12px
  - 圓形容器內置中 icon
- [ ] Tooltip（title 屬性）：
  - 已連線：「Slack 已連接：{App 名稱}」
  - 已斷線：「Slack 已斷線：{App 名稱}」
  - 連線中：「Slack 連線中：{App 名稱}」

---

## Phase 8：修改既有元件

影響檔案：
- `frontend/src/components/layout/AppHeader.vue`
- `frontend/src/components/canvas/PodContextMenu.vue`
- `frontend/src/components/pod/CanvasPod.vue`
- `frontend/src/components/canvas/CanvasContainer.vue`

### 8-1：修改 AppHeader - 新增鑰匙按鈕

- [ ] 修改 `frontend/src/components/layout/AppHeader.vue`
- [ ] import `KeyRound` icon 從 lucide-vue-next
- [ ] import `SlackAppsModal` 從 `@/components/slack/SlackAppsModal.vue`
- [ ] 新增 `showSlackAppsModal: ref<boolean>` 狀態
- [ ] 在 `ConnectionStatus` 和 Canvas Selector 之間新增按鈕：
  - 使用 `<button>` 元素
  - class：`flex items-center justify-center rounded-md p-2 hover:bg-accent`
  - title：「Slack Apps 管理」
  - 內容：`<KeyRound class="h-4 w-4" />`
  - click 事件：`showSlackAppsModal = true`
- [ ] 在 template 底部加入 `<SlackAppsModal v-model:open="showSlackAppsModal" />`

### 8-2：修改 PodContextMenu - 新增 Slack 選項

- [ ] 修改 `frontend/src/components/canvas/PodContextMenu.vue`
- [ ] import `MessageSquare`、`Unplug` icon 從 lucide-vue-next
- [ ] import `useSlackStore` 和 `usePodStore`
- [ ] 取得 Pod 實例：`const pod = computed(() => usePodStore().getPodById(props.podId))`
- [ ] 判斷是否已綁定：`const isSlackBound = computed(() => !!pod.value?.slackBinding)`
- [ ] 新增 emit：
  - `connect-slack: [podId: string]` - 通知父層開啟 SlackConnectModal
  - `disconnect-slack: [podId: string]` - 通知父層執行斷開
- [ ] 在現有的「打開工作目錄」按鈕之後新增分隔線和選項：
  - 若 `!isSlackBound`：顯示「連接 Slack」按鈕，icon 為 `MessageSquare`，點擊 emit `connect-slack`
  - 若 `isSlackBound`：顯示「斷開 Slack」按鈕，icon 為 `Unplug`，點擊 emit `disconnect-slack`
- [ ] 兩個按鈕都需要在 click 後 emit `close`

### 8-3：修改 CanvasPod - 加入 SlackStatusIcon

- [ ] 修改 `frontend/src/components/pod/CanvasPod.vue`
- [ ] import `SlackStatusIcon` 從 `@/components/pod/SlackStatusIcon.vue`
- [ ] 在 Pod 主卡片 div（class 含 `pod-doodle`）內，`<PodAnchors>` 之前或之後，加入：
  ```
  <SlackStatusIcon :slack-binding="pod.slackBinding" />
  ```
- [ ] SlackStatusIcon 的 absolute 定位相對於 `pod-doodle` 元素（已有 `relative` class）

### 8-4：修改 CanvasContainer - 處理 Slack 右鍵選單事件

- [ ] 修改 `frontend/src/components/canvas/CanvasContainer.vue`
- [ ] import `SlackConnectModal` 從 `@/components/slack/SlackConnectModal.vue`
- [ ] import `useSlackStore`
- [ ] 新增狀態：
  - `slackConnectModal: ref<{ visible: boolean; podId: string }>` 初始值 `{ visible: false, podId: '' }`
  - `showDisconnectSlackConfirm: ref<boolean>` 初始值 false
  - `disconnectSlackPodId: ref<string>` 初始值 ''
- [ ] 新增方法 `handleConnectSlack(podId: string)`：
  - 設定 `slackConnectModal.value = { visible: true, podId }`
  - 關閉 PodContextMenu
- [ ] 新增方法 `handleDisconnectSlack(podId: string)`：
  - 設定 `disconnectSlackPodId = podId`、`showDisconnectSlackConfirm = true`
  - 關閉 PodContextMenu
- [ ] 新增方法 `handleConfirmDisconnectSlack()`：
  - 呼叫 `useSlackStore().unbindSlackFromPod(disconnectSlackPodId.value)`
  - 關閉確認 Dialog
- [ ] 修改 `<PodContextMenu>` 元件，新增事件監聽：
  - `@connect-slack="handleConnectSlack"`
  - `@disconnect-slack="handleDisconnectSlack"`
- [ ] 在 Modals 區域新增：
  - `<SlackConnectModal v-model:open="slackConnectModal.visible" :pod-id="slackConnectModal.podId" />`
  - 斷開確認 Dialog（使用 Shadcn UI Dialog）：
    - 標題：「斷開 Slack」
    - 描述：「確定要斷開此 Pod 的 Slack 連線嗎？Pod 將不再接收 Slack 訊息。」
    - 按鈕：取消 + 確認斷開（destructive 樣式）

---

## Phase 9：App 初始化整合

影響檔案：
- `frontend/src/App.vue`

### 9-1：載入 Slack App 列表

- [ ] 修改 `frontend/src/App.vue`
- [ ] 在 `useCanvasContext()` 解構中新增 `slackStore`
- [ ] 在 `loadCanvasData` 方法的 `Promise.all` 中新增：
  ```
  slackStore.loadSlackApps()
  ```
  - Slack App 不隸屬於特定 Canvas，但在 Canvas 資料載入時一起取得即可
  - 若 loadSlackApps 失敗不應阻斷其他資料載入，因此放在 Promise.all 中讓其自行處理錯誤
- [ ] 在 Canvas 切換（watch `canvasStore.activeCanvasId`）時不需要清除 slackStore（Slack App 為全域資源，不隨 Canvas 切換而重載）

---

## 元件檔案結構總覽

```
frontend/src/
├── types/
│   └── slack.ts                         (新建)
├── stores/
│   └── slackStore.ts                    (新建)
├── components/
│   ├── slack/
│   │   ├── SlackAppsModal.vue           (新建)
│   │   └── SlackConnectModal.vue        (新建)
│   ├── pod/
│   │   └── SlackStatusIcon.vue          (新建)
│   ├── layout/
│   │   └── AppHeader.vue                (修改)
│   └── canvas/
│       ├── PodContextMenu.vue           (修改)
│       └── CanvasContainer.vue          (修改)
├── composables/
│   ├── canvas/
│   │   └── useCanvasContext.ts           (修改)
│   └── useUnifiedEventListeners.ts      (修改)
└── App.vue                              (修改)
```

---

## 與後端的 WebSocket 事件對照表

| 前端送出事件 | 用途 | 後端回應事件 |
|---|---|---|
| `slack:app:create` | 註冊新的 Slack App | `slack:app:created` |
| `slack:app:delete` | 刪除 Slack App | `slack:app:deleted` |
| `slack:app:list` | 列出所有 Slack App | `slack:app:list:result` |
| `slack:app:get` | 取得單一 Slack App | `slack:app:get:result` |
| `slack:app:channels` | 取得 App 的頻道列表 | `slack:app:channels:result` |
| `slack:app:channels:refresh` | 重新整理 App 的頻道列表 | `slack:app:channels:refreshed` |
| `pod:bind-slack` | Pod 綁定 Slack App + 單一頻道 | `pod:slack:bound` |
| `pod:unbind-slack` | Pod 解除 Slack 綁定 | `pod:slack:unbound` |
| - (後端主動推送) | Slack App 連線狀態變化 | `slack:connection:status:changed` |
| - (後端主動推送) | 收到 Slack 訊息進入 Pod | `slack:message:received` |
| - (後端主動推送) | Slack 訊息已排隊等待處理 | `slack:message:queued` |

---

## Token 格式驗證規則

| Token 類型 | 前綴 | 驗證正則 |
|---|---|---|
| Bot Token | `xoxb-` | `/^xoxb-[0-9A-Za-z-]+$/` |
| App-Level Token | `xapp-` | `/^xapp-[0-9A-Za-z-]+$/` |

驗證在前端即時進行，不合格時按鈕 disabled 並顯示提示文字。
