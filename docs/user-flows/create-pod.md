# 透過 REST API 建立 Pod

## 正常流程

- 呼叫 `POST /api/canvas/:id/pods`，傳入必填欄位（name、x、y），成功建立 Pod 並回傳完整 Pod 物件（201）
- model 未傳入時，預設使用 opus 建立 Pod
- 建立成功後，畫布上所有連線的用戶透過 WebSocket 收到 `pod:created` 廣播

## 錯誤流程

- `:id` 找不到對應的 Canvas，回傳 404
- 缺少必填欄位（name、x、y 任一），回傳 400
- name 為空字串或超過 100 字元，回傳 400
- model 不是 opus / sonnet / haiku，回傳 400
- 傳入無效的 JSON body，回傳 400
