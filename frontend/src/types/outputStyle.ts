import type { BaseNote } from './note'

export interface OutputStyleListItem {
  id: string
  name: string
  groupId?: string | null
}

export interface OutputStyleNote extends BaseNote {
  outputStyleId: string
}
