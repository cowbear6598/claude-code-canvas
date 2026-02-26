import { onMounted, onUnmounted, ref } from 'vue'
import { useCanvasContext } from './useCanvasContext'
import { createWebSocketRequest, WebSocketRequestEvents, WebSocketResponseEvents } from '@/services/websocket'
import { useWebSocketErrorHandler } from '@/composables/useWebSocketErrorHandler'
import { requireActiveCanvas } from '@/utils/canvasGuard'
import { isEditingElement, isModifierKeyPressed, hasTextSelection } from '@/utils/domHelpers'
import { PASTE_TIMEOUT_MS } from '@/lib/constants'
import type {
  CanvasPasteResultPayload,
  CanvasPastePayload,
  SelectableElement,
} from '@/types'
import { collectSelectedPods, collectSelectedNotes, collectRelatedConnections } from './copyPaste/collectCopyData'
import { calculatePastePositions } from './copyPaste/calculatePaste'

export function useCopyPaste(): void {
  const {
    podStore,
    viewportStore,
    selectionStore,
    outputStyleStore,
    skillStore,
    repositoryStore,
    subAgentStore,
    commandStore,
    clipboardStore,
    connectionStore,
  } = useCanvasContext()

  const mousePosition = ref({ x: 0, y: 0 })

  const updateMousePosition = (event: MouseEvent): void => {
    mousePosition.value = { x: event.clientX, y: event.clientY }
  }

  const handleCopy = (event: KeyboardEvent): boolean => {
    const selectedElements = selectionStore.selectedElements
    if (selectedElements.length === 0) return false

    event.preventDefault()

    const selectedPodIds = new Set(
      selectedElements.filter(el => el.type === 'pod').map(el => el.id)
    )

    const copiedPods = collectSelectedPods(selectedElements, podStore.pods)
    const copiedNotes = collectSelectedNotes(selectedElements, selectedPodIds, outputStyleStore, skillStore, repositoryStore, subAgentStore, commandStore)
    const copiedConnections = collectRelatedConnections(selectedPodIds, connectionStore.connections)

    clipboardStore.setCopy(
      copiedPods,
      copiedNotes.outputStyleNotes,
      copiedNotes.skillNotes,
      copiedNotes.repositoryNotes,
      copiedNotes.subAgentNotes,
      copiedNotes.commandNotes,
      copiedConnections
    )

    return true
  }

  const handlePaste = async (event: KeyboardEvent): Promise<boolean> => {
    if (clipboardStore.isEmpty) return false

    event.preventDefault()

    const canvasPos = viewportStore.screenToCanvas(mousePosition.value.x, mousePosition.value.y)
    const clipboardData = clipboardStore.getCopiedData()
    const { pods, outputStyleNotes, skillNotes, repositoryNotes, subAgentNotes, commandNotes, connections } = calculatePastePositions(canvasPos, clipboardData)

    const { wrapWebSocketRequest } = useWebSocketErrorHandler()

    const response = await wrapWebSocketRequest(
      createWebSocketRequest<CanvasPastePayload, CanvasPasteResultPayload>({
        requestEvent: WebSocketRequestEvents.CANVAS_PASTE,
        responseEvent: WebSocketResponseEvents.CANVAS_PASTE_RESULT,
        payload: {
          canvasId: requireActiveCanvas(),
          pods,
          outputStyleNotes,
          skillNotes,
          repositoryNotes,
          subAgentNotes,
          commandNotes,
          connections,
        },
        timeout: PASTE_TIMEOUT_MS
      })
    )

    if (!response) return false

    const newSelectedElements: SelectableElement[] = [
      ...response.createdPods.map(pod => ({ type: 'pod' as const, id: pod.id })),
      ...response.createdOutputStyleNotes
        .filter(note => note.boundToPodId === null)
        .map(note => ({ type: 'outputStyleNote' as const, id: note.id })),
      ...response.createdSkillNotes
        .filter(note => note.boundToPodId === null)
        .map(note => ({ type: 'skillNote' as const, id: note.id })),
      ...response.createdRepositoryNotes
        .filter(note => note.boundToPodId === null)
        .map(note => ({ type: 'repositoryNote' as const, id: note.id })),
      ...response.createdSubAgentNotes
        .filter(note => note.boundToPodId === null)
        .map(note => ({ type: 'subAgentNote' as const, id: note.id })),
      ...response.createdCommandNotes
        .filter(note => note.boundToPodId === null)
        .map(note => ({ type: 'commandNote' as const, id: note.id })),
    ]

    selectionStore.setSelectedElements(newSelectedElements)

    return true
  }

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (!isModifierKeyPressed(event)) return
    if (isEditingElement()) return

    const key = event.key.toLowerCase()

    if (key === 'c') {
      if (hasTextSelection()) return
      handleCopy(event)
    } else if (key === 'v') {
      handlePaste(event)
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousemove', updateMousePosition)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown)
    document.removeEventListener('mousemove', updateMousePosition)
  })
}
