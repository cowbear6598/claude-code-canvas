# frontend

- Vue3 + Typescript
- Agent 畫布的前端
- 與後端使用 websocket 溝通

## 技術棧

- Vue3
- TypeScript
- Tailwind CSS
- Shadcn UI
- Pinia

# backend

- Bun + TypeScript
- Agent 畫布的後端
- 串接 Claude Agent SDK
- 使用 Bun 原生 WebSocket (已從 Socket.io 遷移)

## 技術棧

- Bun Runtime
- TypeScript
- Bun 原生 WebSocket
- Claude Agent SDK

## WebSocket 架構

- 使用 Bun 原生 WebSocket 替代 Socket.io
- 自定義訊息協議 (type, requestId, payload)
- 連線管理器 (connectionManager)
- Room 管理器 (roomManager)
- 事件路由器 (eventRouter)
- 心跳機制 (15 秒間隔，10 秒超時，最多遺失 2 次)

# 特別注意

- 不需要執行 `bun run dev` 指令，我這邊都會常駐開啟
- 如果你有改動到任何後端程式碼，請告訴我要重啟
- 錯誤訊息/註解內容，都使用 zh-TW 撰寫
- 後端已從 Node.js + Socket.io 遷移到 Bun + 原生 WebSocket