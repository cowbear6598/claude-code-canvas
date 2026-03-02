# Slack App 註冊與連線流程

```mermaid
graph TD
    A[使用者點擊 Header 鑰匙 Icon] --> B[開啟管理 Modal]
    B --> C[輸入 App 名稱 + Bot Token + App-Level Token]
    C --> D{Token 格式驗證}
    D -->|格式錯誤| E[顯示錯誤訊息]
    D -->|格式正確| F{檢查 Token 是否已存在}
    F -->|相同 Token 已連線| G[使用現有連線]
    F -->|新 Token| H[後端 Socket Mode 連線]
    H --> I{連線成功?}
    I -->|連線失敗| J[顯示連線失敗訊息]
    I -->|連線成功| K[取得 Slack 頻道清單]
    K --> L[顯示結果及頻道列表]
    G --> L
```

# Pod 綁定 Slack 流程

```mermaid
graph TD
    A[右鍵 Pod] --> B[選 '連接 Slack']
    B --> C[選 App]
    C --> D[選頻道]
    D --> E[確認綁定]
    E --> F[Pod 加入 slack_reply Tool]
    F --> G[Pod 顯示 Slack Icon]
    G --> H[綁定完成]
```

# Slack 訊息接收與處理流程

```mermaid
graph TD
    A[Slack 使用者 @tag Bot] --> B[Slack 平台]
    B --> C[Socket Mode]
    C --> D[後端 SlackAppManager]
    D --> E[查詢綁定的 Pods]
    E --> F{遍歷每個 Pod}
    F --> G{Pod 狀態判斷}
    G -->|idle| H[注入訊息到 Chat]
    G -->|chatting| I[進入排隊佇列]
    H --> J[觸發 Claude]
    J --> K[Claude 處理訊息]
    K --> L{使用 slack_reply Tool?}
    L -->|是| M[後端 Slack API 發送回覆]
    L -->|否| N[處理完成]
    M --> O[Slack Platform 顯示回覆]
    I --> P[Pod 空閒後取出]
    P --> Q[自動處理]
    Q --> K
    D --> R[前端透過 WebSocket 即時更新]
    O --> R
```

# 連線健康檢查流程

```mermaid
graph TD
    A[後端定期檢查] --> B{偵測 Socket 連線狀態}
    B -->|連線正常| C[保持連接]
    B -->|連線斷線| D[開始 Backoff 重連]
    D --> E{重連成功?}
    E -->|失敗| F[繼續 Backoff 重試]
    F --> E
    E -->|成功| G[連線恢復]
    D --> H[通知前端]
    G --> H
    H --> I[更新 Pod Slack Icon 狀態]
```

# 完整資料流向圖

```mermaid
graph TB
    subgraph SlackPlatform["Slack Platform"]
        A[Slack 使用者]
        B[Slack API]
    end

    subgraph Backend["後端"]
        C[SlackAppManager]
        D[Socket Mode Client]
        E[Pod Chat Manager]
    end

    subgraph PodRuntime["Pod Runtime"]
        F[Pod Chat]
        G[Claude Agent SDK]
        H["slack_reply MCP Tool"]
    end

    subgraph Frontend["前端"]
        I["UI 元件"]
    end

    A -->|@tag Bot| B
    B --> D
    D --> C
    C --> E
    E --> F
    F --> G
    G --> H
    H --> C
    C --> B
    B --> A
    C -->|WebSocket 狀態更新| I
    D -->|連線狀態| C
```
