[English](README.en.md)

# Claude Code Canvas

視覺化設計與執行 AI Agent 工作流程的畫布工具，串接 Claude Agent SDK 驅動 Agent 執行，也可支援團隊多人協作。

## 目錄

- [注意事項](#注意事項)
- [安裝](#安裝)
- [啟動](#啟動)
- [環境變數](#環境變數)
- [教學](#教學)
  - [什麼是 POD？](#什麼是-pod)
  - [如何切換模型？](#如何切換模型)
  - [Slot 說明](#slot-說明)
  - [Connection Line](#connection-line)

## 注意事項

- 目前還在 **Alpha 版本**，功能與介面可能會有較大變動
- 建議在 **Local 環境** 使用，不建議部署到雲端（本工具目前沒有使用者認證機制）
- 因為使用 **Claude Agent SDK**，請確保此服務啟動在**已登入 Claude 的環境**，暫時不支援 API Key
- 目前**僅在 macOS 上測試過**，其他作業系統可能會有未知問題
- 畫布資料會存放在 `~/Documents/ClaudeCanvas`

## 安裝

**前提條件：** Bun

```bash
cd frontend && bun install
cd backend && bun install
```

## 啟動

**前端**

```bash
cd frontend && bun run dev
```

啟動後運行於 port 5173。

**後端**

```bash
cd backend && bun run dev
```

啟動後運行於 port 3001。

**正式環境**

```bash
cd backend && bun run prod
```

會自動建置前端並一起啟動。

## 環境變數

如果要使用 Clone 相關功能存取私有 Repository，請在 `backend/` 目錄下建立 `.env` 檔案：

```bash
# GitHub Token，用於存取私有 Repository
GITHUB_TOKEN=ghp_xxxxx

# GitLab Token，用於存取私有 Repository（支援 GitLab.com 及自架）
GITLAB_TOKEN=glpat-xxxxx

# 自架 GitLab 網址（選填，預設為 gitlab.com）
GITLAB_URL=https://gitlab.example.com
```

## 教學

### 什麼是 POD？

- 一個 Pod = Claude Code
- 右鍵畫布 → Pod 即可建立

![Pod](tutorials/pod.png)

### 如何切換模型？

- 移動到 Pod 上方的模型標籤，就可以選擇 Opus / Sonnet / Haiku

![Switch Model](tutorials/switch-model.gif)

### Slot 說明

- Skills / SubAgents 可以放入多個
- Style（Output Style）/ Command（Slash Command）/ Repo 只能單個
- Command 會讓你的訊息前方自動加入，例如：`/command message`
- Repo 會更改你的工作目錄，沒有放入則是 Pod 自己的目錄

![Slot](tutorials/slot.gif)

### Connection Line

- Auto：不管怎樣都會往下一個 Pod 執行
- AI：會交由 AI 判斷有沒有需要往下一個 Pod 執行
- Direct：不理會其他 Connection Line 直接執行

#### 多條觸發規則

當 Pod 被多條 Connection Line 接入：

- Auto + Auto = 當兩條都準備好時，則會觸發 Pod
- Auto + AI = 當 AI 拒絕時，則不會觸發，同意時，則會觸發 Pod
- Direct + Direct = 當一條完成時，會等 10 秒看其他 Direct 是否完成，如果完成則一起做總結觸發 Pod，等不到的話則會各自總結
- Auto + Auto + Direct + Direct = 會分成兩組（Auto 組與 Direct 組）去做總結，哪一條先完成則會先觸發那組，另一組則會進入 queue 等待觸發

![Connection Line](tutorials/connection-line.gif)
