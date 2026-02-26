# Canvas API

基底 URL：`http://localhost:3001`

## 通用規則

- 所有錯誤回應格式：`{ "error": "訊息" }`

### 通用錯誤碼

| 狀態碼 | 說明 |
|--------|------|
| 404 | 找不到資源 |
| 500 | 伺服器錯誤 |

---

## Canvas 物件結構

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "my-canvas",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "sortIndex": 0
}
```

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | string (UUID) | 畫布唯一識別碼 |
| name | string | 畫布名稱 |
| createdAt | string (ISO 8601) | 建立時間 |
| sortIndex | number | 排序索引，越小排越前面 |

---

## GET /api/canvas/list

取得目前所有畫布的清單。

**回應 200（有資料）：**

```json
{
  "canvases": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "my-canvas",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "sortIndex": 0
    },
    {
      "id": "661f9511-f30c-52e5-b827-557766551111",
      "name": "another-canvas",
      "createdAt": "2024-01-02T00:00:00.000Z",
      "sortIndex": 1
    }
  ]
}
```

**回應 200（空陣列）：**

```json
{
  "canvases": []
}
```

**curl 範例：**

```bash
curl http://localhost:3001/api/canvas/list
```

**JavaScript fetch 範例：**

```javascript
const response = await fetch('http://localhost:3001/api/canvas/list');
const data = await response.json();
console.log(data.canvases);
```
