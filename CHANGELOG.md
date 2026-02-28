# Changelog

## [0.2.1] - 2026-03-01

### 新增
- Workflow 中 Pod 的 input 限制功能（中間 Pod 禁止輸入、頭/尾 Pod 執行中 disabled）

### 修正
- 調整 CHANGELOG 內容與 release 規則

### 重構
- 統一 Zod Schema，提取共用 base schemas
- 抽取 useModalForm composable 和 validators，消除表單邏輯重複
- 合併 6 個 PodSlot 為 2 個泛型元件（PodSingleBindSlot、PodMultiBindSlot）
- createNoteStore 工廠內建 CRUD 支援
- 重構高/中複雜度函式（useBatchDrag、messageBuilder、repositoryService 等）
- 強化型別安全，移除 any 型別
- 魔術數字抽為具名常數
- 清理無意義註解與未使用程式碼
- 統一進度追蹤邏輯（Progress composable）
- Logger 服務改善
- Security 修正（路徑驗證、metadata schema、ID 格式驗證）
- 補充測試覆蓋

## [0.2.0] - 2026-02-28

### 新增
- 新增 MCP Server 支援
- 統一事件監聽器與 WebSocket 事件定義
- 新增 Release 自動化流程

### 修正
- 修正 ToolOutputModal 權限檢查、Pod 刪除清理邏輯
- install.sh 改用 ~/.local/bin 免 sudo、下載顯示進度條
- 修正 install.sh 換行符問題

## [0.1.0] - 2026-02-28

### 新增
- ClaudeService 統一管理所有 Claude Agent SDK 互動
- CLI 入口（claude-canvas 指令：start/stop/status/config）
- curl 安裝腳本 install.sh
- 編譯腳本 scripts/compile.ts
- GitHub Actions release workflow

### 修正
- 修復 compile binary 中 daemon spawn argv 問題
- 修復 SDK pathToClaudeCodeExecutable 在 compile 模式下的路徑問題
- 修復 queryService repositoryId path traversal 漏洞

### 重構
- 統一 Claude Agent SDK 呼叫為 ClaudeService class
- 抽取 getMimeType 為共用模組
- 抽取 getLastAssistantMessage 為共用 helper
