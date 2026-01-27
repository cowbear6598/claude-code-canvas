import { onMounted, onUnmounted, ref } from 'vue'
import { useCanvasContext } from './useCanvasContext'
import { websocketClient, createWebSocketRequest, WebSocketRequestEvents, WebSocketResponseEvents } from '@/services/websocket'
import { useWebSocketErrorHandler } from '@/composables/useWebSocketErrorHandler'
import { isEditingElement, isModifierKeyPressed, hasTextSelection } from '@/utils/domHelpers'
import { POD_WIDTH, POD_HEIGHT, NOTE_WIDTH, NOTE_HEIGHT, PASTE_TIMEOUT_MS } from '@/lib/constants'
import { useRepositoryStore } from '@/stores/note'
import type {
  CanvasPasteResultPayload,
  CanvasPastePayload,
  PodJoinBatchPayload,
  SelectableElement,
  CopiedPod,
  CopiedOutputStyleNote,
  CopiedSkillNote,
  CopiedRepositoryNote,
  CopiedConnection
} from '@/types'

export function useCopyPaste() {
  const {
    podStore,
    viewportStore,
    selectionStore,
    outputStyleStore,
    skillStore,
    clipboardStore,
    connectionStore
  } = useCanvasContext()

  const repositoryStore = useRepositoryStore()

  const mousePosition = ref({ x: 0, y: 0 })

  const updateMousePosition = (event: MouseEvent): void => {
    mousePosition.value = { x: event.clientX, y: event.clientY }
  }

  const collectBoundNotes = (
    podId: string,
    outputStyleNotes: CopiedOutputStyleNote[],
    skillNotes: CopiedSkillNote[],
    repositoryNotes: CopiedRepositoryNote[]
  ): void => {
    const boundOutputStyleNotes = outputStyleStore.notes.filter(
      note => note.boundToPodId === podId
    )
    for (const note of boundOutputStyleNotes) {
      outputStyleNotes.push({
        id: note.id,
        outputStyleId: note.outputStyleId,
        name: note.name,
        x: note.x,
        y: note.y,
        boundToPodId: note.boundToPodId,
        originalPosition: note.originalPosition,
      })
    }

    const boundSkillNotes = skillStore.notes.filter(
      note => note.boundToPodId === podId
    )
    for (const note of boundSkillNotes) {
      skillNotes.push({
        id: note.id,
        skillId: note.skillId,
        name: note.name,
        x: note.x,
        y: note.y,
        boundToPodId: note.boundToPodId,
        originalPosition: note.originalPosition,
      })
    }

    const boundRepositoryNotes = repositoryStore.notes.filter(
      note => note.boundToPodId === podId
    )
    for (const note of boundRepositoryNotes) {
      repositoryNotes.push({
        repositoryId: note.repositoryId,
        name: note.name,
        x: note.x,
        y: note.y,
        boundToOriginalPodId: note.boundToPodId,
        originalPosition: note.originalPosition,
      })
    }
  }

  const collectUnboundOutputStyleNote = (noteId: string): CopiedOutputStyleNote | null => {
    const note = outputStyleStore.notes.find(n => n.id === noteId)
    if (!note || note.boundToPodId !== null) return null

    return {
      id: note.id,
      outputStyleId: note.outputStyleId,
      name: note.name,
      x: note.x,
      y: note.y,
      boundToPodId: note.boundToPodId,
      originalPosition: note.originalPosition,
    }
  }

  const collectUnboundSkillNote = (noteId: string): CopiedSkillNote | null => {
    const note = skillStore.notes.find(n => n.id === noteId)
    if (!note || note.boundToPodId !== null) return null

    return {
      id: note.id,
      skillId: note.skillId,
      name: note.name,
      x: note.x,
      y: note.y,
      boundToPodId: note.boundToPodId,
      originalPosition: note.originalPosition,
    }
  }

  const collectUnboundRepositoryNote = (noteId: string): CopiedRepositoryNote | null => {
    const note = repositoryStore.notes.find(n => n.id === noteId)
    if (!note || note.boundToPodId !== null) return null

    return {
      repositoryId: note.repositoryId,
      name: note.name,
      x: note.x,
      y: note.y,
      boundToOriginalPodId: note.boundToPodId,
      originalPosition: note.originalPosition,
    }
  }

  const handleCopy = (event: KeyboardEvent): boolean => {
    const selectedElements = selectionStore.selectedElements
    if (selectedElements.length === 0) return false

    event.preventDefault()

    const copiedPods: CopiedPod[] = []
    const copiedOutputStyleNotes: CopiedOutputStyleNote[] = []
    const copiedSkillNotes: CopiedSkillNote[] = []
    const copiedRepositoryNotes: CopiedRepositoryNote[] = []

    const selectedPodIds = new Set(
      selectedElements.filter(el => el.type === 'pod').map(el => el.id)
    )

    for (const element of selectedElements) {
      if (element.type === 'pod') {
        const pod = podStore.pods.find(p => p.id === element.id)
        if (pod) {
          copiedPods.push({
            id: pod.id,
            name: pod.name,
            type: pod.type,
            color: pod.color,
            x: pod.x,
            y: pod.y,
            rotation: pod.rotation,
            outputStyleId: pod.outputStyleId,
            skillIds: pod.skillIds,
            model: pod.model,
            repositoryId: pod.repositoryId,
          })
        }
      }
    }

    for (const podId of selectedPodIds) {
      collectBoundNotes(podId, copiedOutputStyleNotes, copiedSkillNotes, copiedRepositoryNotes)
    }

    for (const element of selectedElements) {
      if (element.type === 'outputStyleNote') {
        const note = collectUnboundOutputStyleNote(element.id)
        if (note) {
          copiedOutputStyleNotes.push(note)
        }
      } else if (element.type === 'skillNote') {
        const note = collectUnboundSkillNote(element.id)
        if (note) {
          copiedSkillNotes.push(note)
        }
      } else if (element.type === 'repositoryNote') {
        const note = collectUnboundRepositoryNote(element.id)
        if (note) {
          copiedRepositoryNotes.push(note)
        }
      }
    }

    const copiedConnections: CopiedConnection[] = []
    for (const connection of connectionStore.connections) {
      if (selectedPodIds.has(connection.sourcePodId) && selectedPodIds.has(connection.targetPodId)) {
        copiedConnections.push({
          sourcePodId: connection.sourcePodId,
          sourceAnchor: connection.sourceAnchor,
          targetPodId: connection.targetPodId,
          targetAnchor: connection.targetAnchor,
          autoTrigger: connection.autoTrigger,
        })
      }
    }

    clipboardStore.setCopy(copiedPods, copiedOutputStyleNotes, copiedSkillNotes, copiedRepositoryNotes, copiedConnections)
    return true
  }

  const updateBoundingBox = (
    bounds: { minX: number; maxX: number; minY: number; maxY: number },
    x: number,
    y: number,
    width: number,
    height: number
  ) => {
    bounds.minX = Math.min(bounds.minX, x)
    bounds.maxX = Math.max(bounds.maxX, x + width)
    bounds.minY = Math.min(bounds.minY, y)
    bounds.maxY = Math.max(bounds.maxY, y + height)
  }

  const calculatePastePositions = (targetPosition: { x: number; y: number }) => {
    const { pods, outputStyleNotes, skillNotes, repositoryNotes, connections } = clipboardStore.getCopiedData()

    if (pods.length === 0 && outputStyleNotes.length === 0 && skillNotes.length === 0 && repositoryNotes.length === 0) {
      return { pods: [], outputStyleNotes: [], skillNotes: [], repositoryNotes: [], connections: [] }
    }

    const bounds = {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity
    }

    for (const pod of pods) {
      updateBoundingBox(bounds, pod.x, pod.y, POD_WIDTH, POD_HEIGHT)
    }

    for (const note of outputStyleNotes) {
      if (note.boundToPodId === null) {
        updateBoundingBox(bounds, note.x, note.y, NOTE_WIDTH, NOTE_HEIGHT)
      }
    }

    for (const note of skillNotes) {
      if (note.boundToPodId === null) {
        updateBoundingBox(bounds, note.x, note.y, NOTE_WIDTH, NOTE_HEIGHT)
      }
    }

    for (const note of repositoryNotes) {
      if (note.boundToOriginalPodId === null) {
        updateBoundingBox(bounds, note.x, note.y, NOTE_WIDTH, NOTE_HEIGHT)
      }
    }

    const centerX = (bounds.minX + bounds.maxX) / 2
    const centerY = (bounds.minY + bounds.maxY) / 2

    const offsetX = targetPosition.x - centerX
    const offsetY = targetPosition.y - centerY

    const newPods = pods.map(pod => ({
      originalId: pod.id,
      name: pod.name,
      type: pod.type,
      color: pod.color,
      x: pod.x + offsetX,
      y: pod.y + offsetY,
      rotation: pod.rotation,
      outputStyleId: pod.outputStyleId,
      skillIds: pod.skillIds,
      model: pod.model,
      repositoryId: pod.repositoryId,
    }))

    const newOutputStyleNotes = outputStyleNotes.map(note => ({
      outputStyleId: note.outputStyleId,
      name: note.name,
      x: note.boundToPodId !== null ? 0 : note.x + offsetX,
      y: note.boundToPodId !== null ? 0 : note.y + offsetY,
      boundToOriginalPodId: note.boundToPodId,
      originalPosition: note.originalPosition,
    }))

    const newSkillNotes = skillNotes.map(note => ({
      skillId: note.skillId,
      name: note.name,
      x: note.boundToPodId !== null ? 0 : note.x + offsetX,
      y: note.boundToPodId !== null ? 0 : note.y + offsetY,
      boundToOriginalPodId: note.boundToPodId,
      originalPosition: note.originalPosition,
    }))

    const newRepositoryNotes = repositoryNotes.map(note => ({
      repositoryId: note.repositoryId,
      name: note.name,
      x: note.boundToOriginalPodId !== null ? 0 : note.x + offsetX,
      y: note.boundToOriginalPodId !== null ? 0 : note.y + offsetY,
      boundToOriginalPodId: note.boundToOriginalPodId,
      originalPosition: note.originalPosition,
    }))

    const newConnections = connections.map(conn => ({
      originalSourcePodId: conn.sourcePodId,
      sourceAnchor: conn.sourceAnchor,
      originalTargetPodId: conn.targetPodId,
      targetAnchor: conn.targetAnchor,
      autoTrigger: conn.autoTrigger,
    }))

    return {
      pods: newPods,
      outputStyleNotes: newOutputStyleNotes,
      skillNotes: newSkillNotes,
      repositoryNotes: newRepositoryNotes,
      connections: newConnections,
    }
  }

  const handlePaste = async (event: KeyboardEvent): Promise<boolean> => {
    if (clipboardStore.isEmpty) return false

    event.preventDefault()

    const canvasPos = viewportStore.screenToCanvas(mousePosition.value.x, mousePosition.value.y)
    const { pods, outputStyleNotes, skillNotes, repositoryNotes, connections } = calculatePastePositions(canvasPos)

    const { wrapWebSocketRequest } = useWebSocketErrorHandler()

    const response = await wrapWebSocketRequest(
      createWebSocketRequest<CanvasPastePayload, CanvasPasteResultPayload>({
        requestEvent: WebSocketRequestEvents.CANVAS_PASTE,
        responseEvent: WebSocketResponseEvents.CANVAS_PASTE_RESULT,
        payload: {
          pods,
          outputStyleNotes,
          skillNotes,
          repositoryNotes,
          connections,
        },
        timeout: PASTE_TIMEOUT_MS
      }),
      '貼上失敗'
    )

    if (!response) return false

    for (const pod of response.createdPods) {
      podStore.addPod(pod)
    }

    const createdPodIds = response.createdPods.map(p => p.id)
    if (createdPodIds.length > 0) {
      websocketClient.emit<PodJoinBatchPayload>(WebSocketRequestEvents.POD_JOIN_BATCH, { podIds: createdPodIds })
    }

    for (const note of response.createdOutputStyleNotes) {
      outputStyleStore.notes.push(note)
    }

    for (const note of response.createdSkillNotes) {
      skillStore.notes.push(note)
    }

    for (const note of response.createdRepositoryNotes) {
      repositoryStore.notes.push(note)
    }

    for (const conn of response.createdConnections) {
      connectionStore.connections.push({
        ...conn,
        createdAt: new Date(conn.createdAt),
        autoTrigger: conn.autoTrigger ?? false,
        status: 'inactive',
      })
    }

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
