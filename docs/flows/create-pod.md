# 透過 REST API 建立 Pod

```mermaid
graph TD
    A[External Agent] -->|POST /api/canvas/:id/pods<br/>body: name, x, y, model?| B[apiRouter.ts]
    B -->|URLPattern 匹配| C[podApi.ts<br/>handleCreatePod]

    C -->|解析 JSON body| D{Body 有效?}
    D -->|否| E[400 Bad Request]

    D -->|是| F[驗證必填欄位<br/>name, x, y]
    F -->|缺少欄位| G[400 Bad Request]

    F -->|有效| H[驗證 name<br/>長度 1-100]
    H -->|不合法| I[400 Bad Request]

    H -->|有效| J[驗證 model<br/>opus/sonnet/haiku]
    J -->|不合法| K[400 Bad Request]

    J -->|有效| L[resolveCanvas<br/>params.id]
    L -->|找不到| M[404 Not Found]

    L -->|找到| N[podStore.create<br/>canvasId, pod object]
    N --> O[建立 workspace<br/>目錄]
    O --> P[socketService<br/>廣播 pod:created]

    P --> Q[201 Created<br/>body: pod object]

    E --> R[Client]
    G --> R
    I --> R
    K --> R
    M --> R
    Q --> R
```

## 流程說明

| 步驟 | 說明 |
|------|------|
| 1 | 外部 Agent 發送 POST 請求到 `/api/canvas/:id/pods`，攜帶 name、x、y、model（選擇性） |
| 2 | apiRouter.ts 使用 URLPattern 解析 URL，提取 canvasId 路徑參數，匹配到對應 handler |
| 3 | podApi.ts 中的 handleCreatePod 解析 JSON body |
| 4 | 若 body 解析失敗，回傳 400 Bad Request |
| 5 | 驗證必填欄位 name、x、y，若缺少則回傳 400 |
| 6 | 驗證 name 長度在 1-100 之間，不合法則回傳 400 |
| 7 | 驗證 model 值為 opus、sonnet 或 haiku（若提供），不合法則回傳 400 |
| 8 | 使用 resolveCanvas(params.id) 查詢 Canvas，找不到則回傳 404 |
| 9 | Canvas 存在，呼叫 podStore.create() 建立 Pod 物件 |
| 10 | 在檔案系統建立 workspace 目錄 |
| 11 | 透過 socketService 廣播 pod:created 事件給所有連線客戶端 |
| 12 | 回傳 201 Created + Pod 物件內容 |
