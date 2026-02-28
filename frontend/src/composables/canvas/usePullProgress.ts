import { type Ref, type ComputedRef } from 'vue'
import { WebSocketResponseEvents } from '@/types/websocket'
import type { RepositoryPullLatestProgressPayload, RepositoryPullLatestResultPayload } from '@/types/websocket'
import { useCanvasContext } from '@/composables/canvas/useCanvasContext'
import { useProgressTracker } from '@/composables/canvas/useProgressTracker'
import type { ProgressTask } from '@/components/canvas/ProgressNote.vue'

export type PullStatus = 'pulling' | 'completed' | 'failed'

export interface PullTask {
  requestId: string
  repositoryName: string
  repositoryId: string
  progress: number
  message: string
  status: PullStatus
  timedOut: boolean
}

interface UsePullProgressReturn {
  pullTasks: Ref<Map<string, PullTask>>
  progressTasks: ComputedRef<Map<string, ProgressTask>>
  addTask: (requestId: string, repositoryName: string, repositoryId: string) => void
  removeTask: (requestId: string) => void
  setupListeners: () => void
  cleanupListeners: () => void
}

export function usePullProgress(): UsePullProgressReturn {
  const { repositoryStore } = useCanvasContext()

  const tracker = useProgressTracker<
    PullTask,
    RepositoryPullLatestProgressPayload,
    RepositoryPullLatestResultPayload
  >({
    progressEvent: WebSocketResponseEvents.REPOSITORY_PULL_LATEST_PROGRESS,
    resultEvent: WebSocketResponseEvents.REPOSITORY_PULL_LATEST_RESULT,

    getRequestId: (payload) => payload.requestId,

    createTask: () => null,

    updateTask: (task, payload) => {
      task.progress = payload.progress
      task.message = payload.message
    },

    isProcessingStatus: (task) => task.status === 'pulling',

    onResult: async (task, payload, helpers) => {
      if (task.timedOut) return

      if (payload.success) {
        task.status = 'completed'
        task.progress = 100
        task.message = 'Pull 完成'

        await repositoryStore.loadRepositories()

        helpers.showSuccessToast('Git', 'Pull 成功', task.repositoryName)

        helpers.scheduleRemove(payload.requestId, 1000)
      } else {
        const errorMessage = payload.error || 'Pull 失敗'
        task.status = 'failed'
        task.message = errorMessage

        helpers.showErrorToast('Git', 'Pull 失敗', errorMessage)

        helpers.scheduleRemove(payload.requestId, 2000)
      }
    },

    onTimeout: (task, helpers) => {
      task.timedOut = true
      task.status = 'failed'
      task.message = '操作逾時，請重試'

      helpers.scheduleRemove(task.requestId, 2000)
    },

    toProgressTask: (task) => ({
      requestId: task.requestId,
      title: task.repositoryName,
      progress: task.progress,
      message: task.message,
      status: task.status === 'pulling' ? 'processing' : task.status,
    }),
  })

  const addTask = (requestId: string, repositoryName: string, repositoryId: string): void => {
    tracker.addTask(requestId, {
      requestId,
      repositoryName,
      repositoryId,
      progress: 0,
      message: '準備 Pull...',
      status: 'pulling',
      timedOut: false,
    })
  }

  return {
    pullTasks: tracker.tasks,
    progressTasks: tracker.progressTasks,
    addTask,
    removeTask: tracker.removeTask,
    setupListeners: tracker.setupListeners,
    cleanupListeners: tracker.cleanupListeners,
  }
}
