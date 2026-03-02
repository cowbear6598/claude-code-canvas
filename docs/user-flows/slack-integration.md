# Slack 整合 User Flow

---

## Flow 1：註冊 Slack App

**前置條件**
- 使用者已取得 Slack Bot Token（xoxb-）與 App-Level Token（xapp-）
- 畫布頁面已開啟

**步驟**

1. 使用者點擊 Header 上的「鑰匙 Icon」按鈕
2. 開啟 Slack Apps 管理 Modal，列出目前已註冊的 App（名稱、連線狀態）
3. 點擊「新增 App」
4. 輸入 App 名稱、Bot Token、App-Level Token
5. 點擊確認，後端透過 Socket Mode 連線到 Slack
6. 連線成功後，後端透過 Slack API 取得 Bot 已加入的頻道清單
7. Modal 更新，顯示連線狀態（綠點）與可用頻道列表

**後置條件**
- App 已儲存並顯示在列表中
- 連線狀態為綠點（連線中）
- 可用頻道列表已載入

**異常處理**

- Token 格式錯誤：輸入框即時顯示格式不符提示，無法送出
- 連線失敗（Token 無效或網路問題）：Modal 顯示錯誤訊息，App 不儲存
- 相同 Token 已存在：後端共用既有的 Socket Mode 連線，不重複建立，正常完成新增
- 頻道列表取得失敗：顯示提示訊息，頻道列表為空，App 仍正常儲存

---

## Flow 2：Pod 綁定 Slack App 與頻道

**前置條件**
- 至少已有一個連線狀態正常的 Slack App
- 畫布上有可操作的 Pod

**步驟**

1. 使用者在畫布上右鍵點擊一個 Pod
2. 右鍵選單顯示「連接 Slack」選項
3. 點擊後開啟選擇 Modal，列出所有已註冊的 Slack App
4. 使用者選擇一個 App，Modal 顯示該 App 的可用頻道清單
5. 使用者選擇一個或多個頻道
6. 點擊確認
7. Pod 右上角出現綠色 Slack Icon
8. 後端為該 Pod 動態加入 `slack_reply` MCP Tool
9. Pod 開始接收所選頻道的 Slack 訊息

**後置條件**
- Pod 已綁定指定 App 與頻道
- Pod 右上角顯示綠色 Slack Icon
- Pod 具備 `slack_reply` Tool

**異常處理**

- 無已註冊的 App：選單提示「尚未有可用的 Slack App」，引導前往新增
- 選擇的 App 連線已中斷：仍可完成綁定，但 Slack Icon 顯示紅色
- Pod 已綁定過其他 App/頻道：開啟 Modal 時顯示目前綁定狀態，可重新選擇覆蓋

---

## Flow 3：接收 Slack 訊息並自動觸發 Claude 處理

**前置條件**
- Pod 已綁定 Slack App 與頻道
- Slack Bot 已被加入對應頻道

**步驟**

1. 使用者在 Slack 頻道 @tag Bot 並發送訊息
2. 後端 Slack Bolt App 收到 `app_mention` 事件
3. 後端查找所有綁定此 App 與頻道的 Pod
4. 對每個綁定的 Pod：
   - Pod 閒置中（idle）：訊息注入 Pod 的 Chat，自動觸發 Claude 處理
   - Pod 忙碌中（chatting）：訊息進入排隊佇列，等 Pod 空閒後依序處理
5. 前端透過 WebSocket 即時收到推送，顯示進入的訊息與 Claude 回應

**後置條件**
- 訊息已出現在 Pod 的 Chat 中
- Claude 已開始或排隊等待處理

**異常處理**

- 查無綁定的 Pod：訊息被忽略，不做任何處理
- Pod 已斷開 Slack 連線：訊息被忽略
- 訊息注入失敗：記錄錯誤 log，前端不更新

---

## Flow 4：Claude 透過 MCP Tool 回覆到 Slack

**前置條件**
- Claude 正在處理一個來自 Slack 的訊息
- Pod 的 `slack_reply` Tool 已存在

**步驟**

1. Claude 判斷需要回覆到 Slack
2. Claude 呼叫 `slack_reply` Tool，帶入 channel、thread_ts、text 參數
3. 後端透過 Slack Web API（`chat.postMessage`）將訊息發送到對應頻道與 Thread
4. Slack 頻道的使用者在原 Thread 中看到 Bot 的回覆

**後置條件**
- Slack Thread 中已出現 Bot 回覆
- Pod 的 Chat 中可看到 Tool 呼叫記錄

**異常處理**

- Slack API 發送失敗（Token 失效、頻道無權限）：Tool 回傳錯誤給 Claude，Claude 可在 Chat 中說明無法回覆
- thread_ts 不存在：Slack API 回傳錯誤，Tool 回傳錯誤給 Claude

---

## Flow 5：斷開 Pod 的 Slack 連線

**前置條件**
- Pod 已綁定 Slack App 與頻道

**步驟**

1. 使用者右鍵點擊已連接 Slack 的 Pod
2. 右鍵選單顯示「斷開 Slack」選項
3. 點擊後出現確認提示
4. 使用者確認後：
   - Pod 右上角的 Slack Icon 消失
   - 後端移除該 Pod 的 `slack_reply` MCP Tool
   - Pod 不再接收任何 Slack 訊息
   - 排隊中尚未處理的訊息全部丟棄

**後置條件**
- Pod 無任何 Slack 綁定
- Pod 不具備 `slack_reply` Tool
- Slack Icon 已從 Pod 移除

**異常處理**

- 使用者取消確認：不執行任何動作，維持原本連線狀態

---

## Flow 6：Slack App 連線健康檢查與自動重連

**前置條件**
- 至少已有一個已註冊的 Slack App

**步驟**

1. 後端定期檢查所有 Socket Mode 連線狀態
2. 偵測到連線斷開後，自動依 backoff 策略嘗試重連
3. 連線狀態有變化時，後端透過 WebSocket 通知前端
4. 前端更新所有使用該 App 的 Pod 的 Slack Icon 顏色：
   - 斷線：綠色變紅色
   - 重連成功：紅色變綠色
5. Slack Apps 管理 Modal 中的連線狀態同步更新

**後置條件**
- 重連成功：App 與所有綁定 Pod 恢復正常運作
- 重連失敗（超過重試次數）：App 與 Pod 維持紅色斷線狀態，等待人工處理

**異常處理**

- 重連持續失敗：停止重試，前端顯示紅點並提示使用者手動重新設定 App
- 重連期間有新的 Slack 訊息進入：訊息遺失，不做補償處理
