import type { BaseNote } from './note'

export interface Command {
  id: string
  name: string
  groupId?: string | null
}

export interface CommandNote extends BaseNote {
  commandId: string
}
