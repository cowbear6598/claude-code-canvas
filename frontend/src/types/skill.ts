import type { BaseNote } from './note'

export interface Skill {
  id: string
  name: string
  description: string
}

export interface SkillNote extends BaseNote {
  skillId: string
}
