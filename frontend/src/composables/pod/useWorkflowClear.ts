import type { Ref } from 'vue'
import { ref } from 'vue'
import { useWebSocketErrorHandler } from '@/composables/useWebSocketErrorHandler'
import { createWebSocketRequest, WebSocketRequestEvents, WebSocketResponseEvents } from '@/services/websocket'
import type {
  WorkflowGetDownstreamPodsResultPayload,
  WorkflowClearResultPayload,
  WorkflowGetDownstreamPodsPayload,
  WorkflowClearPayload
} from '@/types/websocket'
import { getActiveCanvasIdOrWarn } from '@/utils/canvasGuard'

interface ClearStores {
  chatStore: {
    clearMessagesByPodIds: (podIds: string[]) => void
  }
  podStore: {
    clearPodOutputsByIds: (podIds: string[]) => void
  }
  connectionStore: {
    getAiDecideConnectionsBySourcePodId: (podId: string) => { id: string }[]
    clearAiDecideStatusByConnectionIds: (connectionIds: string[]) => void
  }
}

interface UseWorkflowClearReturn {
  showClearDialog: Ref<boolean>
  downstreamPods: Ref<Array<{ id: string; name: string }>>
  isLoadingDownstream: Ref<boolean>
  isClearing: Ref<boolean>
  handleClearWorkflow: () => Promise<void>
  handleConfirmClear: () => Promise<void>
  handleCancelClear: () => void
}

export function useWorkflowClear(
  podId: Ref<string>,
  stores: ClearStores
): UseWorkflowClearReturn {
  const { chatStore, podStore, connectionStore } = stores

  const showClearDialog = ref(false)
  const downstreamPods = ref<Array<{ id: string; name: string }>>([])
  const isLoadingDownstream = ref(false)
  const isClearing = ref(false)

  const handleClearWorkflow = async (): Promise<void> => {
    const canvasId = getActiveCanvasIdOrWarn('useWorkflowClear')
    if (!canvasId) return

    isLoadingDownstream.value = true

    const { wrapWebSocketRequest } = useWebSocketErrorHandler()

    const response = await wrapWebSocketRequest(
      createWebSocketRequest<WorkflowGetDownstreamPodsPayload, WorkflowGetDownstreamPodsResultPayload>({
        requestEvent: WebSocketRequestEvents.WORKFLOW_GET_DOWNSTREAM_PODS,
        responseEvent: WebSocketResponseEvents.WORKFLOW_GET_DOWNSTREAM_PODS_RESULT,
        payload: {
          canvasId,
          sourcePodId: podId.value
        }
      })
    )

    isLoadingDownstream.value = false

    if (!response) return
    if (!response.pods) return

    downstreamPods.value = response.pods
    showClearDialog.value = true
  }

  const handleConfirmClear = async (): Promise<void> => {
    const canvasId = getActiveCanvasIdOrWarn('useWorkflowClear')
    if (!canvasId) return

    isClearing.value = true

    const { wrapWebSocketRequest } = useWebSocketErrorHandler()

    const response = await wrapWebSocketRequest(
      createWebSocketRequest<WorkflowClearPayload, WorkflowClearResultPayload>({
        requestEvent: WebSocketRequestEvents.WORKFLOW_CLEAR,
        responseEvent: WebSocketResponseEvents.WORKFLOW_CLEAR_RESULT,
        payload: {
          canvasId,
          sourcePodId: podId.value
        }
      })
    )

    isClearing.value = false

    if (!response) return
    if (!response.clearedPodIds) return

    chatStore.clearMessagesByPodIds(response.clearedPodIds)
    podStore.clearPodOutputsByIds(response.clearedPodIds)

    const downstreamAiDecideConnectionIds: string[] = []
    response.clearedPodIds.forEach(clearedPodId => {
      const connections = connectionStore.getAiDecideConnectionsBySourcePodId(clearedPodId)
      downstreamAiDecideConnectionIds.push(...connections.map(connection => connection.id))
    })

    if (downstreamAiDecideConnectionIds.length > 0) {
      connectionStore.clearAiDecideStatusByConnectionIds(downstreamAiDecideConnectionIds)
    }

    showClearDialog.value = false
    downstreamPods.value = []
  }

  const handleCancelClear = (): void => {
    showClearDialog.value = false
    downstreamPods.value = []
  }

  return {
    showClearDialog,
    downstreamPods,
    isLoadingDownstream,
    isClearing,
    handleClearWorkflow,
    handleConfirmClear,
    handleCancelClear
  }
}
