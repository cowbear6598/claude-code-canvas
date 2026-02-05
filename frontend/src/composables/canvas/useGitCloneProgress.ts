import { ref, watch, type Ref } from 'vue'
import { websocketClient } from '@/services/websocket'
import { WebSocketResponseEvents } from '@/types/websocket'
import type { RepositoryGitCloneProgressPayload, RepositoryGitCloneResultPayload } from '@/types/websocket'
import { useToast } from '@/composables/useToast'
import { useCanvasContext } from '@/composables/canvas/useCanvasContext'

export type CloneStatus = 'cloning' | 'completed' | 'failed'

export interface CloneTask {
  requestId: string
  repoName: string
  progress: number
  message: string
  status: CloneStatus
}

export function useGitCloneProgress() {
  const cloneTasks = ref<Map<string, CloneTask>>(new Map())
  const { showSuccessToast, showErrorToast } = useToast()
  const { repositoryStore, chatStore } = useCanvasContext()
  const listenersRegistered = ref(false)

  const addTask = (requestId: string, repoName: string): void => {
    cloneTasks.value.set(requestId, {
      requestId,
      repoName,
      progress: 0,
      message: '開始下載...',
      status: 'cloning',
    })
  }

  const removeTask = (requestId: string): void => {
    cloneTasks.value.delete(requestId)
    cloneTasks.value = new Map(cloneTasks.value)
  }

  const handleProgress = (payload: RepositoryGitCloneProgressPayload): void => {
    const task = cloneTasks.value.get(payload.requestId)
    if (!task) return

    if (task.status !== 'cloning') {
      return
    }

    task.progress = payload.progress
    task.message = payload.message
  }

  /**
   * 將 Git Clone 錯誤轉換為用戶友善訊息
   *
   * 需要多層錯誤檢查的原因：
   * 1. 後端回傳的錯誤訊息格式不一致（有些是錯誤代碼，有些是描述文字）
   * 2. 需要處理大小寫差異（error.includes 與 lowerError.includes）
   * 3. 需要覆蓋多種可能的錯誤來源（網路、權限、檔案系統等）
   * 4. 優先檢查錯誤代碼（精確匹配），再檢查描述文字（模糊匹配）
   */
  const getErrorMessage = (error: string): string => {
    const lowerError = error.toLowerCase()

    if (error.includes('ALREADY_EXISTS')) {
      return '倉庫已存在'
    }

    if (lowerError.includes('authentication') || lowerError.includes('401') || lowerError.includes('403')) {
      return 'Token 權限不足，請檢查 .env 中的 Token 設定'
    }

    if (lowerError.includes('not found') || lowerError.includes('404')) {
      return '找不到倉庫'
    }

    if (lowerError.includes('network') || lowerError.includes('timeout')) {
      return '網路連線失敗'
    }

    if (lowerError.includes('branch') || lowerError.includes('ref')) {
      return '指定的分支不存在'
    }

    if (lowerError.includes('space') || lowerError.includes('disk')) {
      return '磁碟空間不足'
    }

    return error
  }

  const handleResult = async (payload: RepositoryGitCloneResultPayload): Promise<void> => {
    const task = cloneTasks.value.get(payload.requestId)
    if (!task) return

    if (payload.success) {
      task.status = 'completed'
      task.progress = 100
      task.message = '下載完畢'

      showSuccessToast('Repository', 'Clone 成功', task.repoName)

      await repositoryStore.loadRepositories()

      setTimeout(() => {
        removeTask(payload.requestId)
      }, 1000)
    } else {
      const errorMessage = payload.error ? getErrorMessage(payload.error) : '未知錯誤'
      task.status = 'failed'
      task.message = errorMessage

      showErrorToast('Repository', 'Clone 失敗', errorMessage)

      setTimeout(() => {
        removeTask(payload.requestId)
      }, 2000)
    }
  }

  const setupListeners = (): void => {
    if (listenersRegistered.value) {
      return
    }

    websocketClient.on<RepositoryGitCloneProgressPayload>(
      WebSocketResponseEvents.REPOSITORY_GIT_CLONE_PROGRESS,
      handleProgress
    )

    websocketClient.on<RepositoryGitCloneResultPayload>(
      WebSocketResponseEvents.REPOSITORY_GIT_CLONE_RESULT,
      handleResult
    )

    listenersRegistered.value = true
  }

  const cleanupListeners = (): void => {
    if (!listenersRegistered.value) {
      return
    }

    websocketClient.off<RepositoryGitCloneProgressPayload>(
      WebSocketResponseEvents.REPOSITORY_GIT_CLONE_PROGRESS,
      handleProgress
    )

    websocketClient.off<RepositoryGitCloneResultPayload>(
      WebSocketResponseEvents.REPOSITORY_GIT_CLONE_RESULT,
      handleResult
    )

    listenersRegistered.value = false
  }

  watch(
    () => chatStore.connectionStatus,
    (status) => {
      if (status === 'connected') {
        setupListeners()
      }
    },
    { immediate: true }
  )

  return {
    cloneTasks: cloneTasks as Ref<Map<string, CloneTask>>,
    addTask,
    removeTask,
    setupListeners,
    cleanupListeners,
  }
}
