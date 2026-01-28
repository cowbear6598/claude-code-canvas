import type { Repository, RepositoryNote } from '@/types'
import { createNoteStore } from './createNoteStore'
import { WebSocketRequestEvents, WebSocketResponseEvents, createWebSocketRequest } from '@/services/websocket'
import { useWebSocketErrorHandler } from '@/composables/useWebSocketErrorHandler'
import type { RepositoryCreatePayload, RepositoryCreatedPayload } from '@/types/websocket'

const store = createNoteStore<Repository, RepositoryNote>({
  storeName: 'repository',
  relationship: 'one-to-one',
  responseItemsKey: 'repositories',
  itemIdField: 'repositoryId',
  events: {
    listItems: {
      request: WebSocketRequestEvents.REPOSITORY_LIST,
      response: WebSocketResponseEvents.REPOSITORY_LIST_RESULT,
    },
    listNotes: {
      request: WebSocketRequestEvents.REPOSITORY_NOTE_LIST,
      response: WebSocketResponseEvents.REPOSITORY_NOTE_LIST_RESULT,
    },
    createNote: {
      request: WebSocketRequestEvents.REPOSITORY_NOTE_CREATE,
      response: WebSocketResponseEvents.REPOSITORY_NOTE_CREATED,
    },
    updateNote: {
      request: WebSocketRequestEvents.REPOSITORY_NOTE_UPDATE,
      response: WebSocketResponseEvents.REPOSITORY_NOTE_UPDATED,
    },
    deleteNote: {
      request: WebSocketRequestEvents.REPOSITORY_NOTE_DELETE,
      response: WebSocketResponseEvents.REPOSITORY_NOTE_DELETED,
    },
  },
  bindEvents: {
    request: WebSocketRequestEvents.POD_BIND_REPOSITORY,
    response: WebSocketResponseEvents.POD_REPOSITORY_BOUND,
  },
  unbindEvents: {
    request: WebSocketRequestEvents.POD_UNBIND_REPOSITORY,
    response: WebSocketResponseEvents.POD_REPOSITORY_UNBOUND,
  },
  deleteItemEvents: {
    request: WebSocketRequestEvents.REPOSITORY_DELETE,
    response: WebSocketResponseEvents.REPOSITORY_DELETED,
  },
  createNotePayload: (item: Repository) => ({
    repositoryId: item.id,
  }),
  getItemId: (item: Repository) => item.id,
  getItemName: (item: Repository) => item.name,
  customActions: {
    async createRepository(this: any, name: string): Promise<{ success: boolean; repository?: { id: string; name: string }; error?: string }> {
      const { wrapWebSocketRequest } = useWebSocketErrorHandler()

      const response = await wrapWebSocketRequest(
        createWebSocketRequest<RepositoryCreatePayload, RepositoryCreatedPayload>({
          requestEvent: WebSocketRequestEvents.REPOSITORY_CREATE,
          responseEvent: WebSocketResponseEvents.REPOSITORY_CREATED,
          payload: { name }
        }),
        '建立資料夾失敗'
      )

      if (!response) {
        return { success: false, error: '建立資料夾失敗' }
      }

      if (!response.repository) {
        return { success: false, error: response.error || '建立資料夾失敗' }
      }

      this.availableItems.push(response.repository)
      return { success: true, repository: response.repository }
    },

    async deleteRepository(this: any, repositoryId: string): Promise<void> {
      return this.deleteItem(repositoryId)
    },

    async loadRepositories(this: any): Promise<void> {
      return this.loadItems()
    },
  }
})

export const useRepositoryStore = store
