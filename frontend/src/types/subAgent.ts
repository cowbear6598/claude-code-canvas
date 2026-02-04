import type { BaseNote } from './note'

export interface SubAgent {
  id: string
  name: string
  description: string
}

export interface SubAgentNote extends BaseNote {
  subAgentId: string
}
