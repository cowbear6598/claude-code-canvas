[English](README.en.md)

# Claude Code Canvas

視覺化設計與執行 AI Agent 工作流程的畫布工具，串接 Claude Agent SDK 驅動 Agent 執行。

## 目錄

- [注意事項](#注意事項)
- [安裝](#安裝)
- [啟動](#啟動)
- [環境變數](#環境變數)
- [教學](#教學)
  - [什麼是 POD？](#什麼是-pod)
  - [如何切換模型？](#如何切換模型)

## 注意事項

- 目前還在 **Alpha 版本**，功能與介面可能會有較大變動
- 建議在 **Local 環境** 使用，不建議部署到雲端（本工具目前沒有使用者認證機制）
- 因為使用 **Claude Agent SDK**，請確保此服務啟動在**已登入 Claude 的環境**，暫時不支援 API Key
- 目前**僅在 macOS 上測試過**，其他作業系統可能會有未知問題

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
