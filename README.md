[English](#english) | 繁體中文

# Claude Code Canvas

- 視覺化設計與執行 AI Agent 工作流程的畫布工具
- 串接 Claude Agent SDK 驅動 Agent 執行

## 注意事項

- 目前還在 **Alpha 版本**，功能與介面可能會有較大變動
- 建議在 **Local 環境** 使用，不建議部署到雲端（本工具目前沒有使用者認證機制）
- 因為使用 **Claude Agent SDK**，請確保此服務啟動在**已登入 Claude 的環境**，否則需要設定 API Key
- 目前**僅在 macOS 上測試過**，其他作業系統可能會有未知問題

## 安裝與啟動

**前提條件：** Bun

**前端**

```bash
cd frontend && bun install && bun run dev
```

啟動後運行於 port 5173。

**後端**

```bash
cd backend && bun install && bun run dev
```

啟動後運行於 port 3001。

**正式環境**

```bash
cd backend && bun run prod
```

會自動建置前端並一起啟動。

---

<a id="english"></a>

[繁體中文](#claude-code-canvas) | English

# Claude Code Canvas

- A canvas tool for visually designing and executing AI Agent workflows
- Powered by Claude Agent SDK for agent execution

## Important Notes

- This project is currently in **Alpha**. Features and UI may change significantly.
- Recommended for **local environment** use only, not recommended for cloud deployment (no user authentication is implemented).
- Since it uses the **Claude Agent SDK**, make sure the service runs in an environment where **Claude is already logged in**. Otherwise, you will need to configure an API Key.
- Currently **only tested on macOS**. Other operating systems may have unknown issues.

## Installation & Getting Started

**Prerequisites:** Bun

**Frontend**

```bash
cd frontend && bun install && bun run dev
```

Runs on port 5173.

**Backend**

```bash
cd backend && bun install && bun run dev
```

Runs on port 3001.

**Production**

```bash
cd backend && bun run prod
```

Builds the frontend and serves everything together from the backend.
