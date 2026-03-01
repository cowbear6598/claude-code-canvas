# Pod API

## GET /api/canvas/:id/pods

取得指定 Canvas 下所有 Pod。`:id` 支援 UUID 或 name。

```bash
curl http://localhost:3001/api/canvas/my-canvas/pods
```

---

## POST /api/canvas/:id/pods

在指定 Canvas 下建立新 Pod。`:id` 支援 UUID 或 name。

### Request Body

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| name | string | 是 | Pod 名稱，1-100 字元 |
| x | number | 是 | X 座標（像素） |
| y | number | 是 | Y 座標（像素） |
| model | string | 否 | 模型類型：`opus` / `sonnet` / `haiku`，預設 `opus` |

> Pod 尺寸為 224x168 px，建議 Pod 之間保持 200px 間距。

### 成功回應 201

```json
{
  "pod": {
    "id": "xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx",
    "name": "My Pod",
    "color": "blue",
    "status": "idle",
    "workspacePath": "/path/to/workspace",
    "x": 100,
    "y": 200,
    "rotation": 0,
    "model": "opus",
    "createdAt": "2026-03-01T00:00:00.000Z",
    "lastActiveAt": "2026-03-01T00:00:00.000Z",
    "skillIds": [],
    "subAgentIds": [],
    "mcpServerIds": [],
    "needsForkSession": false,
    "autoClear": false
  }
}
```

### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 400 | 無效的請求格式 / 驗證失敗 |
| 404 | 找不到 Canvas |

### curl 範例

```bash
# 建立 Pod（使用 canvas name）
curl -X POST http://localhost:3001/api/canvas/my-canvas/pods \
  -H "Content-Type: application/json" \
  -d '{"name": "My Pod", "x": 100, "y": 200}'

# 建立 Pod 並指定 model
curl -X POST http://localhost:3001/api/canvas/my-canvas/pods \
  -H "Content-Type: application/json" \
  -d '{"name": "Sonnet Pod", "x": 244, "y": 200, "model": "sonnet"}'
```
