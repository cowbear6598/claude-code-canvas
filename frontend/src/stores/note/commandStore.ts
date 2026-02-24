import type { Command, CommandNote, Pod } from '@/types'
import { createNoteStore } from './createNoteStore'
import { WebSocketRequestEvents, WebSocketResponseEvents, createWebSocketRequest } from '@/services/websocket'
import { createResourceCRUDActions } from './createResourceCRUDActions'
import { createGroupCRUDActions } from './createGroupCRUDActions'
import { useCanvasStore } from '@/stores/canvasStore'
import type {
  CommandNoteCreatePayload,
  CommandNoteCreatedPayload,
  CommandCreatedPayload,
  CommandUpdatedPayload,
  CommandReadResultPayload,
} from '@/types/websocket'
import type { Group } from '@/types'

interface CommandStoreCustomActions {
  rebuildNotesFromPods(pods: Pod[]): Promise<void>
  createCommand(name: string, content: string): Promise<{ success: boolean; command?: { id: string; name: string }; error?: string }>
  updateCommand(commandId: string, content: string): Promise<{ success: boolean; command?: { id: string; name: string }; error?: string }>
  readCommand(commandId: string): Promise<{ id: string; name: string; content: string } | null>
  deleteCommand(commandId: string): Promise<void>
  loadCommands(): Promise<void>
  loadGroups(): Promise<void>
  createGroup(name: string): Promise<{ success: boolean; group?: Group; error?: string }>
  updateGroup(groupId: string, name: string): Promise<{ success: boolean; group?: Group; error?: string }>
  deleteGroup(groupId: string): Promise<{ success: boolean; error?: string }>
  moveItemToGroup(commandId: string, groupId: string | null): Promise<{ success: boolean; error?: string }>
}

const commandGroupCRUD = createGroupCRUDActions({
  storeName: 'CommandStore',
  groupType: 'command',
  toastCategory: 'Command',
  moveItemToGroupEvents: {
    request: WebSocketRequestEvents.COMMAND_MOVE_TO_GROUP,
    response: WebSocketResponseEvents.COMMAND_MOVED_TO_GROUP,
  },
})

const commandCRUD = createResourceCRUDActions<Command>(
  'Command',
  {
    create: {
      request: WebSocketRequestEvents.COMMAND_CREATE,
      response: WebSocketResponseEvents.COMMAND_CREATED
    },
    update: {
      request: WebSocketRequestEvents.COMMAND_UPDATE,
      response: WebSocketResponseEvents.COMMAND_UPDATED
    },
    read: {
      request: WebSocketRequestEvents.COMMAND_READ,
      response: WebSocketResponseEvents.COMMAND_READ_RESULT
    }
  },
  {
    getUpdatePayload: (commandId, content) => ({ commandId, content }),
    getReadPayload: (commandId) => ({ commandId }),
    extractItemFromResponse: {
      create: (response) => (response as CommandCreatedPayload).command,
      update: (response) => (response as CommandUpdatedPayload).command,
      read: (response) => (response as CommandReadResultPayload).command
    },
    updateItemsList: (items, commandId, newItem) => {
      const index = items.findIndex(item => item.id === commandId)
      if (index !== -1) {
        items[index] = newItem as Command
      }
    }
  },
  'Command'
)

const store = createNoteStore<Command, CommandNote>({
  storeName: 'command',
  relationship: 'one-to-one',
  responseItemsKey: 'commands',
  itemIdField: 'commandId',
  events: {
    listItems: {
      request: WebSocketRequestEvents.COMMAND_LIST,
      response: WebSocketResponseEvents.COMMAND_LIST_RESULT,
    },
    listNotes: {
      request: WebSocketRequestEvents.COMMAND_NOTE_LIST,
      response: WebSocketResponseEvents.COMMAND_NOTE_LIST_RESULT,
    },
    createNote: {
      request: WebSocketRequestEvents.COMMAND_NOTE_CREATE,
      response: WebSocketResponseEvents.COMMAND_NOTE_CREATED,
    },
    updateNote: {
      request: WebSocketRequestEvents.COMMAND_NOTE_UPDATE,
      response: WebSocketResponseEvents.COMMAND_NOTE_UPDATED,
    },
    deleteNote: {
      request: WebSocketRequestEvents.COMMAND_NOTE_DELETE,
      response: WebSocketResponseEvents.COMMAND_NOTE_DELETED,
    },
  },
  bindEvents: {
    request: WebSocketRequestEvents.POD_BIND_COMMAND,
    response: WebSocketResponseEvents.POD_COMMAND_BOUND,
  },
  unbindEvents: {
    request: WebSocketRequestEvents.POD_UNBIND_COMMAND,
    response: WebSocketResponseEvents.POD_COMMAND_UNBOUND,
  },
  deleteItemEvents: {
    request: WebSocketRequestEvents.COMMAND_DELETE,
    response: WebSocketResponseEvents.COMMAND_DELETED,
  },
  groupEvents: {
    listGroups: {
      request: WebSocketRequestEvents.GROUP_LIST,
      response: WebSocketResponseEvents.GROUP_LIST_RESULT,
    },
    createGroup: {
      request: WebSocketRequestEvents.GROUP_CREATE,
      response: WebSocketResponseEvents.GROUP_CREATED,
    },
    updateGroup: {
      request: WebSocketRequestEvents.GROUP_UPDATE,
      response: WebSocketResponseEvents.GROUP_UPDATED,
    },
    deleteGroup: {
      request: WebSocketRequestEvents.GROUP_DELETE,
      response: WebSocketResponseEvents.GROUP_DELETED,
    },
    moveItemToGroup: {
      request: WebSocketRequestEvents.COMMAND_MOVE_TO_GROUP,
      response: WebSocketResponseEvents.COMMAND_MOVED_TO_GROUP,
    },
  },
  createNotePayload: (item: Command) => ({
    commandId: item.id,
  }),
  getItemId: (item: Command) => item.id,
  getItemName: (item: Command) => item.name,
  customActions: {
    async rebuildNotesFromPods(this, pods: Pod[]): Promise<void> {
      const canvasStore = useCanvasStore()
      if (!canvasStore.activeCanvasId) {
        console.warn('[CommandStore] Cannot rebuild notes: no active canvas')
        return
      }

      const promises: Promise<void>[] = []

      for (const pod of pods) {
        if (!pod.commandId) continue

        const existingNotes = this.getNotesByPodId(pod.id)
        if (existingNotes.length > 0) continue

        const command = this.availableItems.find((c: Command) => c.id === pod.commandId)
        const commandName = command?.name || pod.commandId

        const promise = createWebSocketRequest<CommandNoteCreatePayload, CommandNoteCreatedPayload>({
          requestEvent: WebSocketRequestEvents.COMMAND_NOTE_CREATE,
          responseEvent: WebSocketResponseEvents.COMMAND_NOTE_CREATED,
          payload: {
            canvasId: canvasStore.activeCanvasId,
            commandId: pod.commandId,
            name: commandName,
            x: pod.x,
            y: pod.y - 100,
            boundToPodId: pod.id,
            originalPosition: { x: pod.x, y: pod.y - 100 },
          }
        }).then(response => {
          if (response.note) {
            this.notes.push(response.note)
          }
        })

        promises.push(promise)
      }

      if (promises.length > 0) {
        await Promise.all(promises)
      }
    },

    async createCommand(this, name: string, content: string): Promise<{ success: boolean; command?: { id: string; name: string }; error?: string }> {
      const result = await commandCRUD.create(this.availableItems, name, content)
      return result.success ? { success: true, command: result.item } : { success: false, error: result.error }
    },

    async updateCommand(this, commandId: string, content: string): Promise<{ success: boolean; command?: { id: string; name: string }; error?: string }> {
      const result = await commandCRUD.update(this.availableItems, commandId, content)
      return result.success ? { success: true, command: result.item } : { success: false, error: result.error }
    },

    async readCommand(this, commandId: string): Promise<{ id: string; name: string; content: string } | null> {
      return commandCRUD.read(commandId)
    },

    async deleteCommand(this, commandId: string): Promise<void> {
      return this.deleteItem(commandId)
    },

    async loadCommands(this): Promise<void> {
      return this.loadItems()
    },

    loadGroups: commandGroupCRUD.loadGroups,
    createGroup: commandGroupCRUD.createGroup,
    updateGroup: commandGroupCRUD.updateGroup,
    deleteGroup: commandGroupCRUD.deleteGroup,
    moveItemToGroup: commandGroupCRUD.moveItemToGroup,
  }
})

export const useCommandStore: (() => ReturnType<typeof store> & CommandStoreCustomActions) & { $id: string } = store as (() => ReturnType<typeof store> & CommandStoreCustomActions) & { $id: string }
