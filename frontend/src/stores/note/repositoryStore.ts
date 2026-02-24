import type { Repository, RepositoryNote } from '@/types'
import { createNoteStore } from './createNoteStore'
import { websocketClient, WebSocketRequestEvents, WebSocketResponseEvents, createWebSocketRequest } from '@/services/websocket'
import { useWebSocketErrorHandler } from '@/composables/useWebSocketErrorHandler'
import { useCanvasStore } from '@/stores/canvasStore'
import { useToast } from '@/composables/useToast'
import { generateRequestId } from '@/services/utils'
import type {
  RepositoryCreatePayload,
  RepositoryCreatedPayload,
  RepositoryCheckGitPayload,
  RepositoryCheckGitResultPayload,
  RepositoryWorktreeCreatePayload,
  RepositoryWorktreeCreatedPayload,
  RepositoryGetLocalBranchesPayload,
  RepositoryLocalBranchesResultPayload,
  RepositoryCheckDirtyPayload,
  RepositoryDirtyCheckResultPayload,
  RepositoryCheckoutBranchPayload,
  RepositoryDeleteBranchPayload,
  RepositoryBranchDeletedPayload,
  RepositoryPullLatestPayload,
  RepositoryPullLatestResultPayload
} from '@/types/websocket'

interface RepositoryStoreCustomActions {
  createRepository(name: string): Promise<{ success: boolean; repository?: { id: string; name: string }; error?: string }>
  deleteRepository(repositoryId: string): Promise<void>
  loadRepositories(): Promise<void>
  checkIsGit(repositoryId: string): Promise<boolean>
  createWorktree(repositoryId: string, worktreeName: string, sourceNotePosition: { x: number; y: number }): Promise<{ success: boolean; error?: string }>
  getLocalBranches(repositoryId: string): Promise<{ success: boolean; branches?: string[]; currentBranch?: string; worktreeBranches?: string[]; error?: string }>
  checkDirty(repositoryId: string): Promise<{ success: boolean; isDirty?: boolean; error?: string }>
  checkoutBranch(repositoryId: string, branchName: string, force?: boolean): Promise<{ requestId: string }>
  deleteBranch(repositoryId: string, branchName: string): Promise<{ success: boolean; branchName?: string; error?: string }>
  pullLatest(repositoryId: string): Promise<{ success: boolean; error?: string }>
  isWorktree(repositoryId: string): boolean
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
      const { showSuccessToast, showErrorToast } = useToast()
      const canvasStore = useCanvasStore()

      const response = await wrapWebSocketRequest(
        createWebSocketRequest<RepositoryCreatePayload, RepositoryCreatedPayload>({
          requestEvent: WebSocketRequestEvents.REPOSITORY_CREATE,
          responseEvent: WebSocketResponseEvents.REPOSITORY_CREATED,
          payload: {
            canvasId: canvasStore.activeCanvasId!,
            name
          }
        })
      )

      if (!response) {
        showErrorToast('Repository', '建立失敗', '建立資料夾失敗')
        return { success: false, error: '建立資料夾失敗' }
      }

      if (!response.repository) {
        const error = response.error || '建立資料夾失敗'
        showErrorToast('Repository', '建立失敗', error)
        return { success: false, error }
      }

      this.availableItems.push(response.repository)
      showSuccessToast('Repository', '建立成功', name)
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
        })
      )

      if (!response || !response.success) {
        return false
      }

      const existingRepository = this.availableItems.find((item: Repository) => item.id === repositoryId)
      if (existingRepository) {
        existingRepository.isGit = response.isGit
      }

      return response.isGit
    },

    async createWorktree(this, repositoryId: string, worktreeName: string, sourceNotePosition: { x: number; y: number }): Promise<{ success: boolean; error?: string }> {
      const { wrapWebSocketRequest } = useWebSocketErrorHandler()
      const { showSuccessToast, showErrorToast } = useToast()
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
        })
      )

      if (!response) {
        showErrorToast('Repository', 'Worktree 建立失敗')
        return { success: false, error: '建立 Worktree 失敗' }
      }

      if (!response.success) {
        const error = response.error || '建立 Worktree 失敗'
        showErrorToast('Repository', 'Worktree 建立失敗', error)
        return { success: false, error }
      }

      if (response.repository) {
        this.availableItems.push(response.repository)

        // 透過後端 API 建立 Note
        await this.createNote(
          response.repository.id,
          sourceNotePosition.x + 150,
          sourceNotePosition.y + 80
        )
      }

      showSuccessToast('Repository', 'Worktree 建立成功', worktreeName)
      return { success: true }
    },

    async getLocalBranches(this, repositoryId: string): Promise<{ success: boolean; branches?: string[]; currentBranch?: string; worktreeBranches?: string[]; error?: string }> {
      const { wrapWebSocketRequest } = useWebSocketErrorHandler()
      const { showErrorToast } = useToast()
      const canvasStore = useCanvasStore()

      const response = await wrapWebSocketRequest(
        createWebSocketRequest<RepositoryGetLocalBranchesPayload, RepositoryLocalBranchesResultPayload>({
          requestEvent: WebSocketRequestEvents.REPOSITORY_GET_LOCAL_BRANCHES,
          responseEvent: WebSocketResponseEvents.REPOSITORY_LOCAL_BRANCHES_RESULT,
          payload: {
            canvasId: canvasStore.activeCanvasId!,
            repositoryId
          }
        })
      )

      if (!response) {
        showErrorToast('Git', '取得分支列表失敗')
        return { success: false, error: '取得分支列表失敗' }
      }

      return {
        success: response.success,
        branches: response.branches,
        currentBranch: response.currentBranch,
        worktreeBranches: response.worktreeBranches,
        error: response.error
      }
    },

    async checkDirty(this, repositoryId: string): Promise<{ success: boolean; isDirty?: boolean; error?: string }> {
      const { wrapWebSocketRequest } = useWebSocketErrorHandler()
      const { showErrorToast } = useToast()
      const canvasStore = useCanvasStore()

      const response = await wrapWebSocketRequest(
        createWebSocketRequest<RepositoryCheckDirtyPayload, RepositoryDirtyCheckResultPayload>({
          requestEvent: WebSocketRequestEvents.REPOSITORY_CHECK_DIRTY,
          responseEvent: WebSocketResponseEvents.REPOSITORY_DIRTY_CHECK_RESULT,
          payload: {
            canvasId: canvasStore.activeCanvasId!,
            repositoryId
          }
        })
      )

      if (!response) {
        showErrorToast('Git', '檢查修改狀態失敗')
        return { success: false, error: '檢查修改狀態失敗' }
      }

      return {
        success: response.success,
        isDirty: response.isDirty,
        error: response.error
      }
    },

    async checkoutBranch(this, repositoryId: string, branchName: string, force: boolean = false): Promise<{ requestId: string }> {
      const canvasStore = useCanvasStore()
      const requestId = generateRequestId()

      websocketClient.emit<RepositoryCheckoutBranchPayload>(
        WebSocketRequestEvents.REPOSITORY_CHECKOUT_BRANCH,
        {
          requestId,
          canvasId: canvasStore.activeCanvasId!,
          repositoryId,
          branchName,
          force
        }
      )

      return { requestId }
    },

    async deleteBranch(this, repositoryId: string, branchName: string): Promise<{ success: boolean; branchName?: string; error?: string }> {
      const { wrapWebSocketRequest } = useWebSocketErrorHandler()
      const { showSuccessToast, showErrorToast } = useToast()
      const canvasStore = useCanvasStore()

      const response = await wrapWebSocketRequest(
        createWebSocketRequest<RepositoryDeleteBranchPayload, RepositoryBranchDeletedPayload>({
          requestEvent: WebSocketRequestEvents.REPOSITORY_DELETE_BRANCH,
          responseEvent: WebSocketResponseEvents.REPOSITORY_BRANCH_DELETED,
          payload: {
            canvasId: canvasStore.activeCanvasId!,
            repositoryId,
            branchName,
            force: true
          }
        })
      )

      if (!response) {
        showErrorToast('Git', '刪除分支失敗')
        return { success: false, error: '刪除分支失敗' }
      }

      if (response.success) {
        showSuccessToast('Git', '刪除分支成功', branchName)
      } else if (response.error) {
        showErrorToast('Git', '刪除分支失敗', response.error)
      }

      return {
        success: response.success,
        branchName: response.branchName,
        error: response.error
      }
    },

    async pullLatest(this, repositoryId: string): Promise<{ success: boolean; error?: string }> {
      const { wrapWebSocketRequest } = useWebSocketErrorHandler()
      const { showSuccessToast, showErrorToast } = useToast()
      const canvasStore = useCanvasStore()

      const response = await wrapWebSocketRequest(
        createWebSocketRequest<RepositoryPullLatestPayload, RepositoryPullLatestResultPayload>({
          requestEvent: WebSocketRequestEvents.REPOSITORY_PULL_LATEST,
          responseEvent: WebSocketResponseEvents.REPOSITORY_PULL_LATEST_RESULT,
          payload: {
            canvasId: canvasStore.activeCanvasId!,
            repositoryId
          }
        })
      )

      if (!response) {
        showErrorToast('Git', 'Pull 失敗')
        return { success: false, error: 'Pull 失敗' }
      }

      if (response.success) {
        showSuccessToast('Git', 'Pull 成功')
      } else {
        showErrorToast('Git', 'Pull 失敗', response.error)
      }

      return { success: response.success, error: response.error }
    },

    isWorktree(this, repositoryId: string): boolean {
      const repository = this.availableItems.find((item: Repository) => item.id === repositoryId)
      return !!repository?.parentRepoId
    },
  }
})

export const useRepositoryStore: (() => ReturnType<typeof store> & RepositoryStoreCustomActions) & { $id: string } = store as (() => ReturnType<typeof store> & RepositoryStoreCustomActions) & { $id: string }
