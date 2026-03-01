---
name: claude-code-canvas
description: 透過 REST API 操控 claude-code-canvas 畫布系統。當 AI Agent 需要查詢或操控畫布時使用此 Skill 參考可用的端點和格式。
user-invocable: true
disable-model-invocation: false
allowed-tools: Bash(curl *)
---

# claude-code-canvas 概覽

claude-code-canvas 是一個 Agent 畫布系統，後端使用 **Bun + TypeScript** 實作，提供 REST API 通訊方式：

- **REST API**：HTTP 端點，用於查詢畫布資訊

---

## 前置條件

使用此 Skill 前，claude-code-canvas 後端必須正在運行。

- 預設位址：`http://localhost:3001`
- 後端使用 Bun Runtime，需先在 claude-code-canvas 專案目錄執行 `bun run dev`

如果 curl 回傳連線失敗（Connection refused），代表後端尚未啟動，請先啟動後端再重試。

---

## REST API 端點快速索引

基底 URL：`http://localhost:3001`

### Canvas

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | /api/canvas/list | 列出所有畫布 |
| POST | /api/canvas | 建立新畫布 |
| DELETE | /api/canvas/:id | 刪除指定畫布 |

詳細格式與範例：[references/canvas-api.md](references/canvas-api.md)

---

## 錯誤處理

| 情況 | 原因 | 解法 |
|------|------|------|
| `Connection refused` | 後端未啟動 | 在 claude-code-canvas 專案目錄執行 `bun run dev` |
| HTTP 404 | API 路徑錯誤 | 確認 URL 路徑正確 |
| HTTP 500 | 後端內部錯誤 | 查看後端 log 排查問題 |

遇到連線失敗時，告知使用者需要先啟動 claude-code-canvas 後端，不要繼續重試。
