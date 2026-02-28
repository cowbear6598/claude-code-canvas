# Changelog

## [0.2.0] - 2026-02-28

### 新增
- 增加 MCP Server 支援（後端：MCP Server 類型、Store、Schema、Handler 與 Claude Service 整合；前端：MCP Server 類型、Store、Slot 元件與 Modal 元件；事件系統：統一事件監聽器與 WebSocket 事件定義）
- 新增 Release 自動化流程與更新 README

### 修正
- Code review 修正改動
- install.sh printf 改用 %b 格式正確顯示 ANSI 顏色
- install.sh 改用 ~/.local/bin 免 sudo、下載顯示進度條
- install.sh 安裝前確保目錄存在
- 重新正規化 install.sh 換行符（renormalize）
- 強制 .sh 檔案使用 LF 換行符
- 修正 install.sh CRLF 換行符為 LF

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
