import type { BaseNote } from './note'

export interface Command {
  id: string
  name: string
}

export interface CommandNote extends BaseNote {
  commandId: string
}
