import type {Command, CommandNote, Pod} from '@/types'
import {createNoteStore} from './createNoteStore'
import {WebSocketRequestEvents, WebSocketResponseEvents, createWebSocketRequest} from '@/services/websocket'
import type {CommandNoteCreatePayload, CommandNoteCreatedPayload} from '@/types/websocket'

interface CommandStoreCustomActions {
  rebuildNotesFromPods(pods: Pod[]): Promise<void>
  deleteCommand(commandId: string): Promise<void>
  loadCommands(): Promise<void>
}

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
  createNotePayload: (item: Command) => ({
    commandId: item.id,
  }),
  getItemId: (item: Command) => item.id,
  getItemName: (item: Command) => item.name,
  customActions: {
    async rebuildNotesFromPods(this, pods: Pod[]): Promise<void> {
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

    async deleteCommand(this, commandId: string): Promise<void> {
      return this.deleteItem(commandId)
    },

    async loadCommands(this): Promise<void> {
      return this.loadItems()
    },
  }
})

export const useCommandStore: (() => ReturnType<typeof store> & CommandStoreCustomActions) & { $id: string } = store as any
