import type { BaseNote } from './note'

export interface SubAgent {
  id: string
  name: string
  description: string
  groupId?: string | null
}

export interface SubAgentNote extends BaseNote {
  subAgentId: string
}
