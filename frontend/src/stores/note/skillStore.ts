import type { Skill, SkillNote } from '@/types'
import { createNoteStore } from './createNoteStore'
import { WebSocketRequestEvents, WebSocketResponseEvents } from '@/services/websocket'

const store = createNoteStore<Skill, SkillNote>({
  storeName: 'skill',
  relationship: 'one-to-many',
  responseItemsKey: 'skills',
  itemIdField: 'skillId',
  events: {
    listItems: {
      request: WebSocketRequestEvents.SKILL_LIST,
      response: WebSocketResponseEvents.SKILL_LIST_RESULT,
    },
    listNotes: {
      request: WebSocketRequestEvents.SKILL_NOTE_LIST,
      response: WebSocketResponseEvents.SKILL_NOTE_LIST_RESULT,
    },
    createNote: {
      request: WebSocketRequestEvents.SKILL_NOTE_CREATE,
      response: WebSocketResponseEvents.SKILL_NOTE_CREATED,
    },
    updateNote: {
      request: WebSocketRequestEvents.SKILL_NOTE_UPDATE,
      response: WebSocketResponseEvents.SKILL_NOTE_UPDATED,
    },
    deleteNote: {
      request: WebSocketRequestEvents.SKILL_NOTE_DELETE,
      response: WebSocketResponseEvents.SKILL_NOTE_DELETED,
    },
  },
  bindEvents: {
    request: WebSocketRequestEvents.POD_BIND_SKILL,
    response: WebSocketResponseEvents.POD_SKILL_BOUND,
  },
  deleteItemEvents: {
    request: WebSocketRequestEvents.SKILL_DELETE,
    response: WebSocketResponseEvents.SKILL_DELETED,
  },
  createNotePayload: (item: Skill) => ({
    skillId: item.id,
  }),
  getItemId: (item: Skill) => item.id,
  getItemName: (item: Skill) => item.name,
  customActions: {
    async deleteSkill(this: any, skillId: string): Promise<void> {
      return this.deleteItem(skillId)
    },

    async loadSkills(this: any): Promise<void> {
      return this.loadItems()
    },
  }
})

export const useSkillStore = store
