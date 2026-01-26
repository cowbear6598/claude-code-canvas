import type { BaseNote } from './note'

export interface OutputStyleListItem {
  id: string   // 檔名（不含 .md）
  name: string // 顯示名稱（同 id）
}

export interface OutputStyleNote extends BaseNote {
  outputStyleId: string
}
