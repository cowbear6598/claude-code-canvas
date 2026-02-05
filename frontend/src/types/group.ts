export type GroupType = 'command' | 'outputStyle' | 'subAgent'

export interface Group {
  id: string
  name: string
  type: GroupType
}

export interface GroupableItem {
  id: string
  name: string
  groupId?: string | null
}
