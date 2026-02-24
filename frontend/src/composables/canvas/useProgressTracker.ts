import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import { websocketClient } from '@/services/websocket'
import { useToast, type ToastCategory } from '@/composables/useToast'
import { useCanvasContext } from '@/composables/canvas/useCanvasContext'
import type { ProgressTask } from '@/components/canvas/ProgressNote.vue'

const TASK_TIMEOUT_MS = 60_000

export interface ProgressTaskHelpers {
  removeTask: (requestId: string) => void
  showSuccessToast: (category: ToastCategory, action: string, target?: string) => string
  showErrorToast: (category: ToastCategory, action: string, reason?: string) => string
}

export interface ProgressTrackerOptions<TTask, TProgressPayload, TResultPayload> {
  progressEvent: string
  resultEvent: string
  createTask: (payload: TProgressPayload) => TTask | null
  updateTask: (task: TTask, payload: TProgressPayload) => void
  onResult: (task: TTask, payload: TResultPayload, helpers: ProgressTaskHelpers) => void | Promise<void>
  toProgressTask: (task: TTask) => ProgressTask
  getRequestId: (payload: TProgressPayload | TResultPayload) => string
  isProcessingStatus: (task: TTask) => boolean
  onTimeout?: (task: TTask, helpers: ProgressTaskHelpers) => void
}

export interface ProgressTrackerReturn<TTask> {
  tasks: Ref<Map<string, TTask>>
  progressTasks: ComputedRef<Map<string, ProgressTask>>
  addTask: (requestId: string, task: TTask) => void
  removeTask: (requestId: string) => void
  setupListeners: () => void
  cleanupListeners: () => void
}

export function useProgressTracker<TTask, TProgressPayload, TResultPayload>(
  options: ProgressTrackerOptions<TTask, TProgressPayload, TResultPayload>
): ProgressTrackerReturn<TTask> {
  const {
    progressEvent,
    resultEvent,
    createTask,
    updateTask,
    onResult,
    toProgressTask,
    getRequestId,
    isProcessingStatus,
    onTimeout,
  } = options

  const tasks = ref<Map<string, TTask>>(new Map()) as Ref<Map<string, TTask>>
  const { showSuccessToast, showErrorToast } = useToast()
  const { chatStore } = useCanvasContext()
  const listenersRegistered = ref(false)
  const timeoutTimers = new Map<string, ReturnType<typeof setTimeout>>()

  const removeTask = (requestId: string): void => {
    const timer = timeoutTimers.get(requestId)
    if (timer !== undefined) {
      clearTimeout(timer)
      timeoutTimers.delete(requestId)
    }
    tasks.value.delete(requestId)
    tasks.value = new Map(tasks.value)
  }

  const helpers: ProgressTaskHelpers = {
    removeTask,
    showSuccessToast,
    showErrorToast,
  }

  const startTimeout = (requestId: string): void => {
    if (!onTimeout) return

    const timer = setTimeout(() => {
      const task = tasks.value.get(requestId)
      if (!task || !isProcessingStatus(task)) return

      timeoutTimers.delete(requestId)
      onTimeout(task, helpers)
    }, TASK_TIMEOUT_MS)

    timeoutTimers.set(requestId, timer)
  }

  const cancelTimeout = (requestId: string): void => {
    const timer = timeoutTimers.get(requestId)
    if (timer !== undefined) {
      clearTimeout(timer)
      timeoutTimers.delete(requestId)
    }
  }

  const addTask = (requestId: string, task: TTask): void => {
    tasks.value.set(requestId, task)
    startTimeout(requestId)
  }

  const handleProgress = (payload: TProgressPayload): void => {
    const requestId = getRequestId(payload)
    let task = tasks.value.get(requestId)

    if (!task) {
      const newTask = createTask(payload)
      if (!newTask) return
      addTask(requestId, newTask)
      task = tasks.value.get(requestId)!
    }

    if (!isProcessingStatus(task)) return

    updateTask(task, payload)
  }

  const handleResult = async (payload: TResultPayload): Promise<void> => {
    const requestId = getRequestId(payload)
    const task = tasks.value.get(requestId)
    if (!task) return

    cancelTimeout(requestId)

    await onResult(task, payload, helpers)
  }

  const setupListeners = (): void => {
    if (listenersRegistered.value) return

    websocketClient.on<TProgressPayload>(progressEvent, handleProgress)
    websocketClient.on<TResultPayload>(resultEvent, handleResult)

    listenersRegistered.value = true
  }

  const cleanupListeners = (): void => {
    if (!listenersRegistered.value) return

    for (const timer of timeoutTimers.values()) {
      clearTimeout(timer)
    }
    timeoutTimers.clear()

    websocketClient.off<TProgressPayload>(progressEvent, handleProgress)
    websocketClient.off<TResultPayload>(resultEvent, handleResult)

    listenersRegistered.value = false
  }

  const progressTasks = computed<Map<string, ProgressTask>>(() => {
    const result = new Map<string, ProgressTask>()
    for (const [key, task] of tasks.value) {
      result.set(key, toProgressTask(task))
    }
    return result
  })

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
    tasks,
    progressTasks,
    addTask,
    removeTask,
    setupListeners,
    cleanupListeners,
  }
}
