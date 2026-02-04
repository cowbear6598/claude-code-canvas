import type { Repository, RepositoryNote } from '@/types'
import { createNoteStore } from './createNoteStore'
import { WebSocketRequestEvents, WebSocketResponseEvents, createWebSocketRequest } from '@/services/websocket'
import { useWebSocketErrorHandler } from '@/composables/useWebSocketErrorHandler'
import { useCanvasStore } from '@/stores/canvasStore'
import type {
  RepositoryCreatePayload,
  RepositoryCreatedPayload,
  RepositoryCheckGitPayload,
  RepositoryCheckGitResultPayload,
  RepositoryWorktreeCreatePayload,
  RepositoryWorktreeCreatedPayload
} from '@/types/websocket'

interface RepositoryStoreCustomActions {
  createRepository(name: string): Promise<{ success: boolean; repository?: { id: string; name: string }; error?: string }>
  deleteRepository(repositoryId: string): Promise<void>
  loadRepositories(): Promise<void>
  checkIsGit(repositoryId: string): Promise<boolean>
  createWorktree(repositoryId: string, worktreeName: string, sourceNotePosition: { x: number; y: number }): Promise<{ success: boolean; error?: string }>
}

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
    async createRepository(this, name: string): Promise<{ success: boolean; repository?: { id: string; name: string }; error?: string }> {
      const { wrapWebSocketRequest } = useWebSocketErrorHandler()
      const canvasStore = useCanvasStore()

      const response = await wrapWebSocketRequest(
        createWebSocketRequest<RepositoryCreatePayload, RepositoryCreatedPayload>({
          requestEvent: WebSocketRequestEvents.REPOSITORY_CREATE,
          responseEvent: WebSocketResponseEvents.REPOSITORY_CREATED,
          payload: {
            canvasId: canvasStore.activeCanvasId!,
            name
          }
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

    async deleteRepository(this, repositoryId: string): Promise<void> {
      return this.deleteItem(repositoryId)
    },

    async loadRepositories(this): Promise<void> {
      return this.loadItems()
    },

    async checkIsGit(this, repositoryId: string): Promise<boolean> {
      const { wrapWebSocketRequest } = useWebSocketErrorHandler()
      const canvasStore = useCanvasStore()

      const response = await wrapWebSocketRequest(
        createWebSocketRequest<RepositoryCheckGitPayload, RepositoryCheckGitResultPayload>({
          requestEvent: WebSocketRequestEvents.REPOSITORY_CHECK_GIT,
          responseEvent: WebSocketResponseEvents.REPOSITORY_CHECK_GIT_RESULT,
          payload: {
            canvasId: canvasStore.activeCanvasId!,
            repositoryId
          }
        }),
        '檢查 Git Repository 失敗'
      )

      if (!response || !response.success) {
        return false
      }

      const existingRepository = this.availableItems.find((item) => item.id === repositoryId)
      if (existingRepository) {
        existingRepository.isGit = response.isGit
      }

      return response.isGit
    },

    async createWorktree(this, repositoryId: string, worktreeName: string, sourceNotePosition: { x: number; y: number }): Promise<{ success: boolean; error?: string }> {
      const { wrapWebSocketRequest } = useWebSocketErrorHandler()
      const canvasStore = useCanvasStore()

      const response = await wrapWebSocketRequest(
        createWebSocketRequest<RepositoryWorktreeCreatePayload, RepositoryWorktreeCreatedPayload>({
          requestEvent: WebSocketRequestEvents.REPOSITORY_WORKTREE_CREATE,
          responseEvent: WebSocketResponseEvents.REPOSITORY_WORKTREE_CREATED,
          payload: {
            canvasId: canvasStore.activeCanvasId!,
            repositoryId,
            worktreeName
          }
        }),
        '建立 Worktree 失敗'
      )

      if (!response) {
        return { success: false, error: '建立 Worktree 失敗' }
      }

      if (!response.success) {
        return { success: false, error: response.error || '建立 Worktree 失敗' }
      }

      if (response.repository) {
        this.availableItems.push(response.repository)

        const newNote = {
          id: crypto.randomUUID(),
          repositoryId: response.repository.id,
          name: response.repository.name,
          x: sourceNotePosition.x + 150,
          y: sourceNotePosition.y + 80,
          boundToPodId: null,
          originalPosition: null
        }
        this.notes.push(newNote)
      }

      return { success: true }
    },
  }
})

export const useRepositoryStore: (() => ReturnType<typeof store> & RepositoryStoreCustomActions) & { $id: string } = store as any
