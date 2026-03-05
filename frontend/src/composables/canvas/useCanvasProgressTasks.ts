import { computed, onUnmounted } from 'vue'
import type { ComputedRef } from 'vue'
import { useGitCloneProgress, useCheckoutProgress, usePullProgress } from '@/composables/canvas'
import type { ProgressTask } from '@/components/canvas/ProgressNote.vue'

export function useCanvasProgressTasks(): {
  allProgressTasks: ComputedRef<Map<string, ProgressTask>>
  handleCloneStarted: (payload: { requestId: string; repoName: string }) => void
  handlePullStarted: (payload: { requestId: string; repositoryName: string; repositoryId: string }) => void
} {
  const gitCloneProgress = useGitCloneProgress()
  const checkoutProgress = useCheckoutProgress()
  const pullProgress = usePullProgress()

  const allProgressTasks = computed<Map<string, ProgressTask>>(() => {
    const result = new Map<string, ProgressTask>()
    for (const [key, task] of gitCloneProgress.progressTasks.value) {
      result.set(key, task)
    }
    for (const [key, task] of checkoutProgress.progressTasks.value) {
      result.set(key, task)
    }
    for (const [key, task] of pullProgress.progressTasks.value) {
      result.set(key, task)
    }
    return result
  })

  const handleCloneStarted = (payload: { requestId: string; repoName: string }): void => {
    gitCloneProgress.addTask(payload.requestId, payload.repoName)
  }

  const handlePullStarted = (payload: { requestId: string; repositoryName: string; repositoryId: string }): void => {
    pullProgress.addTask(payload.requestId, payload.repositoryName, payload.repositoryId)
  }

  onUnmounted(() => {
    gitCloneProgress.cleanupListeners()
    checkoutProgress.cleanupListeners()
    pullProgress.cleanupListeners()
  })

  return {
    allProgressTasks,
    handleCloneStarted,
    handlePullStarted,
  }
}
