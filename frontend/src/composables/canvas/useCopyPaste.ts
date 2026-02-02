import { onMounted, onUnmounted, ref } from 'vue'
import { useCanvasContext } from './useCanvasContext'
import { websocketClient, createWebSocketRequest, WebSocketRequestEvents, WebSocketResponseEvents } from '@/services/websocket'
import { useWebSocketErrorHandler } from '@/composables/useWebSocketErrorHandler'
import { isEditingElement, isModifierKeyPressed, hasTextSelection } from '@/utils/domHelpers'
import { POD_WIDTH, POD_HEIGHT, NOTE_WIDTH, NOTE_HEIGHT, PASTE_TIMEOUT_MS } from '@/lib/constants'
import type {
  CanvasPasteResultPayload,
  CanvasPastePayload,
  PodJoinBatchPayload,
  SelectableElement,
  CopiedPod,
  CopiedOutputStyleNote,
  CopiedSkillNote,
  CopiedRepositoryNote,
  CopiedSubAgentNote,
  CopiedCommandNote,
  CopiedConnection,
  PastePodItem,
  PasteOutputStyleNoteItem,
  PasteSkillNoteItem,
  PasteRepositoryNoteItem,
  PasteSubAgentNoteItem,
  PasteCommandNoteItem,
  PasteConnectionItem
} from '@/types'

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
    canvasStore
  } = useCanvasContext()

  const mousePosition = ref({ x: 0, y: 0 })

  const updateMousePosition = (event: MouseEvent): void => {
    mousePosition.value = { x: event.clientX, y: event.clientY }
  }

  const collectBoundNotes = (
    podId: string,
    outputStyleNotes: CopiedOutputStyleNote[],
    skillNotes: CopiedSkillNote[],
    repositoryNotes: CopiedRepositoryNote[],
    subAgentNotes: CopiedSubAgentNote[],
    commandNotes: CopiedCommandNote[]
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

    const boundSubAgentNotes = subAgentStore.notes.filter(
      note => note.boundToPodId === podId
    )
    for (const note of boundSubAgentNotes) {
      subAgentNotes.push({
        id: note.id,
        subAgentId: note.subAgentId,
        name: note.name,
        x: note.x,
        y: note.y,
        boundToPodId: note.boundToPodId,
        originalPosition: note.originalPosition,
      })
    }

    const boundCommandNotes = commandStore.notes.filter(
      note => note.boundToPodId === podId
    )
    for (const note of boundCommandNotes) {
      commandNotes.push({
        commandId: note.commandId,
        name: note.name,
        x: note.x,
        y: note.y,
        boundToOriginalPodId: note.boundToPodId,
        originalPosition: note.originalPosition,
      })
    }
  }

  const createUnboundNoteCollector = <T, TNote extends { id?: string; boundToPodId: string | null; x: number; y: number; name: string; originalPosition: { x: number; y: number } | null }>(
    store: { notes: TNote[] },
    mapFn: (note: TNote) => T
  ) => {
    return (noteId: string): T | null => {
      const note = store.notes.find(n => n.id === noteId)
      if (!note || note.boundToPodId !== null) return null
      return mapFn(note)
    }
  }

  const collectUnboundOutputStyleNote = createUnboundNoteCollector<CopiedOutputStyleNote, typeof outputStyleStore.notes[0]>(
    outputStyleStore,
    (note) => ({
      id: note.id,
      outputStyleId: note.outputStyleId,
      name: note.name,
      x: note.x,
      y: note.y,
      boundToPodId: note.boundToPodId,
      originalPosition: note.originalPosition,
    })
  )

  const collectUnboundSkillNote = createUnboundNoteCollector<CopiedSkillNote, typeof skillStore.notes[0]>(
    skillStore,
    (note) => ({
      id: note.id,
      skillId: note.skillId,
      name: note.name,
      x: note.x,
      y: note.y,
      boundToPodId: note.boundToPodId,
      originalPosition: note.originalPosition,
    })
  )

  const collectUnboundRepositoryNote = createUnboundNoteCollector<CopiedRepositoryNote, typeof repositoryStore.notes[0]>(
    repositoryStore,
    (note) => ({
      repositoryId: note.repositoryId,
      name: note.name,
      x: note.x,
      y: note.y,
      boundToOriginalPodId: note.boundToPodId,
      originalPosition: note.originalPosition,
    })
  )

  const collectUnboundSubAgentNote = createUnboundNoteCollector<CopiedSubAgentNote, typeof subAgentStore.notes[0]>(
    subAgentStore,
    (note) => ({
      id: note.id,
      subAgentId: note.subAgentId,
      name: note.name,
      x: note.x,
      y: note.y,
      boundToPodId: note.boundToPodId,
      originalPosition: note.originalPosition,
    })
  )

  const collectUnboundCommandNote = createUnboundNoteCollector<CopiedCommandNote, typeof commandStore.notes[0]>(
    commandStore,
    (note) => ({
      commandId: note.commandId,
      name: note.name,
      x: note.x,
      y: note.y,
      boundToOriginalPodId: note.boundToPodId,
      originalPosition: note.originalPosition,
    })
  )

  const handleCopy = (event: KeyboardEvent): boolean => {
    const selectedElements = selectionStore.selectedElements
    if (selectedElements.length === 0) return false

    event.preventDefault()

    const copiedPods: CopiedPod[] = []
    const copiedOutputStyleNotes: CopiedOutputStyleNote[] = []
    const copiedSkillNotes: CopiedSkillNote[] = []
    const copiedRepositoryNotes: CopiedRepositoryNote[] = []
    const copiedSubAgentNotes: CopiedSubAgentNote[] = []
    const copiedCommandNotes: CopiedCommandNote[] = []

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
            color: pod.color,
            x: pod.x,
            y: pod.y,
            rotation: pod.rotation,
            outputStyleId: pod.outputStyleId,
            skillIds: pod.skillIds,
            subAgentIds: pod.subAgentIds,
            model: pod.model,
            repositoryId: pod.repositoryId,
            commandId: pod.commandId,
          })
        }
      }
    }

    for (const podId of selectedPodIds) {
      collectBoundNotes(podId, copiedOutputStyleNotes, copiedSkillNotes, copiedRepositoryNotes, copiedSubAgentNotes, copiedCommandNotes)
    }

    const noteCollectorMap = {
      outputStyleNote: { collector: collectUnboundOutputStyleNote, array: copiedOutputStyleNotes },
      skillNote: { collector: collectUnboundSkillNote, array: copiedSkillNotes },
      repositoryNote: { collector: collectUnboundRepositoryNote, array: copiedRepositoryNotes },
      subAgentNote: { collector: collectUnboundSubAgentNote, array: copiedSubAgentNotes },
      commandNote: { collector: collectUnboundCommandNote, array: copiedCommandNotes },
    } as const

    for (const element of selectedElements) {
      const collectorInfo = noteCollectorMap[element.type as keyof typeof noteCollectorMap]
      if (collectorInfo) {
        const note = collectorInfo.collector(element.id)
        if (note) {
          collectorInfo.array.push(note as never)
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

    clipboardStore.setCopy(copiedPods, copiedOutputStyleNotes, copiedSkillNotes, copiedRepositoryNotes, copiedSubAgentNotes, copiedCommandNotes, copiedConnections)
    return true
  }

  const updateBoundingBox = (
    bounds: { minX: number; maxX: number; minY: number; maxY: number },
    x: number,
    y: number,
    width: number,
    height: number
  ): void => {
    bounds.minX = Math.min(bounds.minX, x)
    bounds.maxX = Math.max(bounds.maxX, x + width)
    bounds.minY = Math.min(bounds.minY, y)
    bounds.maxY = Math.max(bounds.maxY, y + height)
  }

  const calculatePastePositions = (targetPosition: { x: number; y: number }): {
    pods: PastePodItem[]
    outputStyleNotes: PasteOutputStyleNoteItem[]
    skillNotes: PasteSkillNoteItem[]
    repositoryNotes: PasteRepositoryNoteItem[]
    subAgentNotes: PasteSubAgentNoteItem[]
    commandNotes: PasteCommandNoteItem[]
    connections: PasteConnectionItem[]
  } => {
    const { pods, outputStyleNotes, skillNotes, repositoryNotes, subAgentNotes, commandNotes, connections } = clipboardStore.getCopiedData()

    if (pods.length === 0 && outputStyleNotes.length === 0 && skillNotes.length === 0 && repositoryNotes.length === 0 && subAgentNotes.length === 0 && commandNotes.length === 0) {
      return { pods: [], outputStyleNotes: [], skillNotes: [], repositoryNotes: [], subAgentNotes: [], commandNotes: [], connections: [] }
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

    const processUnboundNotes = <T extends { x: number; y: number }>(
      notes: T[],
      getBoundKey: (n: T) => string | null
    ): void => {
      for (const note of notes) {
        if (getBoundKey(note) === null) {
          updateBoundingBox(bounds, note.x, note.y, NOTE_WIDTH, NOTE_HEIGHT)
        }
      }
    }

    processUnboundNotes(outputStyleNotes, n => n.boundToPodId)
    processUnboundNotes(skillNotes, n => n.boundToPodId)
    processUnboundNotes(repositoryNotes, n => n.boundToOriginalPodId)
    processUnboundNotes(subAgentNotes, n => n.boundToPodId)
    processUnboundNotes(commandNotes, n => n.boundToOriginalPodId)

    const centerX = (bounds.minX + bounds.maxX) / 2
    const centerY = (bounds.minY + bounds.maxY) / 2

    const offsetX = targetPosition.x - centerX
    const offsetY = targetPosition.y - centerY

    const applyOffsetToNote = <T extends { x: number; y: number }>(note: T, isBound: boolean): { x: number; y: number } => ({
      x: isBound ? 0 : note.x + offsetX,
      y: isBound ? 0 : note.y + offsetY,
    })

    const newPods = pods.map(pod => ({
      originalId: pod.id,
      name: pod.name,
      color: pod.color,
      x: pod.x + offsetX,
      y: pod.y + offsetY,
      rotation: pod.rotation,
      outputStyleId: pod.outputStyleId,
      skillIds: pod.skillIds,
      subAgentIds: pod.subAgentIds,
      model: pod.model,
      repositoryId: pod.repositoryId,
      commandId: pod.commandId,
    }))

    const newOutputStyleNotes = outputStyleNotes.map(note => {
      const offset = applyOffsetToNote(note, note.boundToPodId !== null)
      return {
        outputStyleId: note.outputStyleId,
        name: note.name,
        x: offset.x,
        y: offset.y,
        boundToOriginalPodId: note.boundToPodId,
        originalPosition: note.originalPosition,
      }
    })

    const newSkillNotes = skillNotes.map(note => {
      const offset = applyOffsetToNote(note, note.boundToPodId !== null)
      return {
        skillId: note.skillId,
        name: note.name,
        x: offset.x,
        y: offset.y,
        boundToOriginalPodId: note.boundToPodId,
        originalPosition: note.originalPosition,
      }
    })

    const newRepositoryNotes = repositoryNotes.map(note => {
      const offset = applyOffsetToNote(note, note.boundToOriginalPodId !== null)
      return {
        repositoryId: note.repositoryId,
        name: note.name,
        x: offset.x,
        y: offset.y,
        boundToOriginalPodId: note.boundToOriginalPodId,
        originalPosition: note.originalPosition,
      }
    })

    const newSubAgentNotes = subAgentNotes.map(note => {
      const offset = applyOffsetToNote(note, note.boundToPodId !== null)
      return {
        subAgentId: note.subAgentId,
        name: note.name,
        x: offset.x,
        y: offset.y,
        boundToOriginalPodId: note.boundToPodId,
        originalPosition: note.originalPosition,
      }
    })

    const newCommandNotes = commandNotes.map(note => {
      const offset = applyOffsetToNote(note, note.boundToOriginalPodId !== null)
      return {
        commandId: note.commandId,
        name: note.name,
        x: offset.x,
        y: offset.y,
        boundToOriginalPodId: note.boundToOriginalPodId,
        originalPosition: note.originalPosition,
      }
    })

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
      subAgentNotes: newSubAgentNotes,
      commandNotes: newCommandNotes,
      connections: newConnections,
    }
  }

  const handlePaste = async (event: KeyboardEvent): Promise<boolean> => {
    if (clipboardStore.isEmpty) return false

    event.preventDefault()

    const canvasPos = viewportStore.screenToCanvas(mousePosition.value.x, mousePosition.value.y)
    const { pods, outputStyleNotes, skillNotes, repositoryNotes, subAgentNotes, commandNotes, connections } = calculatePastePositions(canvasPos)

    const { wrapWebSocketRequest } = useWebSocketErrorHandler()

    const response = await wrapWebSocketRequest(
      createWebSocketRequest<CanvasPastePayload, CanvasPasteResultPayload>({
        requestEvent: WebSocketRequestEvents.CANVAS_PASTE,
        responseEvent: WebSocketResponseEvents.CANVAS_PASTE_RESULT,
        payload: {
          canvasId: canvasStore.activeCanvasId!,
          pods,
          outputStyleNotes,
          skillNotes,
          repositoryNotes,
          subAgentNotes,
          commandNotes,
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
      websocketClient.emit<PodJoinBatchPayload>(WebSocketRequestEvents.POD_JOIN_BATCH, {
        canvasId: canvasStore.activeCanvasId!,
        podIds: createdPodIds
      })
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

    for (const note of response.createdSubAgentNotes) {
      subAgentStore.notes.push(note)
    }

    for (const note of response.createdCommandNotes) {
      commandStore.notes.push(note)
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
