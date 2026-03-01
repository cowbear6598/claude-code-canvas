# 列出 Canvas 下所有 Pod

## 正常流程

- 呼叫 `GET /api/canvas/:id/pods`，回傳該 Canvas 下所有 Pod 的完整資訊（200）
- Canvas 存在但目前沒有任何 Pod，回傳空陣列（200）

## 錯誤流程

- 傳入的 canvasId 不是合法 UUID 格式，回傳 400
- 傳入的 canvasId 找不到對應的 Canvas，回傳 404
