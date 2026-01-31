import { ref, watch, type Ref } from 'vue'
import { websocketClient } from '@/services/websocket'
import { WebSocketResponseEvents } from '@/types/websocket'
import type { RepositoryGitCloneProgressPayload, RepositoryGitCloneResultPayload } from '@/types/websocket'
import { useToast } from '@/composables/useToast'
import { useRepositoryStore } from '@/stores/note'
import { useChatStore } from '@/stores/chat'

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
  const { toast } = useToast()
  const repositoryStore = useRepositoryStore()
  const chatStore = useChatStore()
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

  const handleResult = async (payload: RepositoryGitCloneResultPayload): Promise<void> => {
    const task = cloneTasks.value.get(payload.requestId)
    if (!task) return

    if (payload.success) {
      task.status = 'completed'
      task.progress = 100
      task.message = '下載完畢'

      toast({
        title: '下載完畢',
        description: `Repository "${task.repoName}" 已成功下載`,
      })

      await repositoryStore.loadRepositories()

      setTimeout(() => {
        removeTask(payload.requestId)
      }, 1000)
    } else {
      task.status = 'failed'
      task.message = payload.error || 'Clone 失敗'

      toast({
        title: 'Clone 失敗',
        description: payload.error || '無法下載 repository',
      })

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
