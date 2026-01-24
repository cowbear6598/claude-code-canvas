export interface OutputStyleListItem {
  id: string   // 檔名（不含 .md）
  name: string // 顯示名稱（同 id）
}

export interface OutputStyleNote {
  id: string           // 便條紙實例 ID (crypto.randomUUID)
  outputStyleId: string
  name: string
  x: number
  y: number
  boundToPodId: string | null
  originalPosition: { x: number; y: number } | null
}
