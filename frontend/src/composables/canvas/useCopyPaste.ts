import { onMounted, onUnmounted, ref } from 'vue'
import { useCanvasContext } from './useCanvasContext'
import { createWebSocketRequest, WebSocketRequestEvents, WebSocketResponseEvents } from '@/services/websocket'
import { useWebSocketErrorHandler } from '@/composables/useWebSocketErrorHandler'
import { isEditingElement, isModifierKeyPressed, hasTextSelection } from '@/utils/domHelpers'
import { POD_WIDTH, POD_HEIGHT, NOTE_WIDTH, NOTE_HEIGHT, PASTE_TIMEOUT_MS } from '@/lib/constants'
import type {
  CanvasPasteResultPayload,
  CanvasPastePayload,
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

  const collectBoundNotesFromStore = <T, TNote extends { boundToPodId: string | null }>(
    podId: string,
    store: { notes: TNote[] },
    mapFn: (note: TNote) => T
  ): T[] => {
    return store.notes
      .filter(note => note.boundToPodId === podId)
      .map(mapFn)
  }

  const collectBoundNotes = (
    podId: string,
    outputStyleNotes: CopiedOutputStyleNote[],
    skillNotes: CopiedSkillNote[],
    repositoryNotes: CopiedRepositoryNote[],
    subAgentNotes: CopiedSubAgentNote[],
    commandNotes: CopiedCommandNote[]
  ): void => {
    outputStyleNotes.push(...collectBoundNotesFromStore(
      podId,
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
    ))

    skillNotes.push(...collectBoundNotesFromStore(
      podId,
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
    ))

    repositoryNotes.push(...collectBoundNotesFromStore(
      podId,
      repositoryStore,
      (note) => ({
        repositoryId: note.repositoryId,
        name: note.name,
        x: note.x,
        y: note.y,
        boundToOriginalPodId: note.boundToPodId,
        originalPosition: note.originalPosition,
      })
    ))

    subAgentNotes.push(...collectBoundNotesFromStore(
      podId,
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
    ))

    commandNotes.push(...collectBoundNotesFromStore(
      podId,
      commandStore,
      (note) => ({
        commandId: note.commandId,
        name: note.name,
        x: note.x,
        y: note.y,
        boundToOriginalPodId: note.boundToPodId,
        originalPosition: note.originalPosition,
      })
    ))
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

  const collectSelectedPods = (selectedElements: SelectableElement[]): CopiedPod[] => {
    const copiedPods: CopiedPod[] = []

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

    return copiedPods
  }

  const collectSelectedNotes = (
    selectedElements: SelectableElement[],
    selectedPodIds: Set<string>
  ): {
    outputStyleNotes: CopiedOutputStyleNote[]
    skillNotes: CopiedSkillNote[]
    repositoryNotes: CopiedRepositoryNote[]
    subAgentNotes: CopiedSubAgentNote[]
    commandNotes: CopiedCommandNote[]
  } => {
    const copiedOutputStyleNotes: CopiedOutputStyleNote[] = []
    const copiedSkillNotes: CopiedSkillNote[] = []
    const copiedRepositoryNotes: CopiedRepositoryNote[] = []
    const copiedSubAgentNotes: CopiedSubAgentNote[] = []
    const copiedCommandNotes: CopiedCommandNote[] = []

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

    return {
      outputStyleNotes: copiedOutputStyleNotes,
      skillNotes: copiedSkillNotes,
      repositoryNotes: copiedRepositoryNotes,
      subAgentNotes: copiedSubAgentNotes,
      commandNotes: copiedCommandNotes,
    }
  }

  const collectRelatedConnections = (selectedPodIds: Set<string>): CopiedConnection[] => {
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

    return copiedConnections
  }

  const handleCopy = (event: KeyboardEvent): boolean => {
    const selectedElements = selectionStore.selectedElements
    if (selectedElements.length === 0) return false

    event.preventDefault()

    const selectedPodIds = new Set(
      selectedElements.filter(el => el.type === 'pod').map(el => el.id)
    )

    const copiedPods = collectSelectedPods(selectedElements)
    const copiedNotes = collectSelectedNotes(selectedElements, selectedPodIds)
    const copiedConnections = collectRelatedConnections(selectedPodIds)

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

  const calculateBoundingBox = <T extends { x: number; y: number }>(
    pods: CopiedPod[],
    notes: {
      outputStyleNotes: T[]
      skillNotes: T[]
      repositoryNotes: T[]
      subAgentNotes: T[]
      commandNotes: T[]
    },
    getBoundKeys: {
      outputStyleNote: (n: T) => string | null
      skillNote: (n: T) => string | null
      repositoryNote: (n: T) => string | null
      subAgentNote: (n: T) => string | null
      commandNote: (n: T) => string | null
    }
  ): { minX: number; maxX: number; minY: number; maxY: number } => {
    const bounds = {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity
    }

    for (const pod of pods) {
      updateBoundingBox(bounds, pod.x, pod.y, POD_WIDTH, POD_HEIGHT)
    }

    const processUnboundNotes = <TNote extends { x: number; y: number }>(
      noteList: TNote[],
      getBoundKey: (n: TNote) => string | null
    ): void => {
      for (const note of noteList) {
        if (getBoundKey(note) === null) {
          updateBoundingBox(bounds, note.x, note.y, NOTE_WIDTH, NOTE_HEIGHT)
        }
      }
    }

    processUnboundNotes(notes.outputStyleNotes, getBoundKeys.outputStyleNote)
    processUnboundNotes(notes.skillNotes, getBoundKeys.skillNote)
    processUnboundNotes(notes.repositoryNotes, getBoundKeys.repositoryNote)
    processUnboundNotes(notes.subAgentNotes, getBoundKeys.subAgentNote)
    processUnboundNotes(notes.commandNotes, getBoundKeys.commandNote)

    return bounds
  }

  const calculateOffsets = (
    boundingBox: { minX: number; maxX: number; minY: number; maxY: number },
    targetPosition: { x: number; y: number }
  ): { offsetX: number; offsetY: number } => {
    const centerX = (boundingBox.minX + boundingBox.maxX) / 2
    const centerY = (boundingBox.minY + boundingBox.maxY) / 2

    return {
      offsetX: targetPosition.x - centerX,
      offsetY: targetPosition.y - centerY
    }
  }

  const transformPods = (
    pods: CopiedPod[],
    offset: { offsetX: number; offsetY: number }
  ): PastePodItem[] => {
    return pods.map(pod => ({
      originalId: pod.id,
      name: pod.name,
      color: pod.color,
      x: pod.x + offset.offsetX,
      y: pod.y + offset.offsetY,
      rotation: pod.rotation,
      outputStyleId: pod.outputStyleId,
      skillIds: pod.skillIds,
      subAgentIds: pod.subAgentIds,
      model: pod.model,
      repositoryId: pod.repositoryId,
      commandId: pod.commandId,
    }))
  }

  const transformNotes = <
    TSource extends { x: number; y: number; name: string; originalPosition: { x: number; y: number } | null },
    TResult
  >(
    notes: TSource[],
    offset: { offsetX: number; offsetY: number },
    getBoundKey: (note: TSource) => string | null,
    mapFn: (note: TSource, position: { x: number; y: number }) => TResult
  ): TResult[] => {
    return notes.map(note => {
      const isBound = getBoundKey(note) !== null
      const position = {
        x: isBound ? 0 : note.x + offset.offsetX,
        y: isBound ? 0 : note.y + offset.offsetY,
      }
      return mapFn(note, position)
    })
  }

  const transformConnections = (connections: CopiedConnection[]): PasteConnectionItem[] => {
    return connections.map(conn => ({
      originalSourcePodId: conn.sourcePodId,
      sourceAnchor: conn.sourceAnchor,
      originalTargetPodId: conn.targetPodId,
      targetAnchor: conn.targetAnchor,
      autoTrigger: conn.autoTrigger,
    }))
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

    const boundingBox = calculateBoundingBox(pods, {
      outputStyleNotes,
      skillNotes,
      repositoryNotes,
      subAgentNotes,
      commandNotes
    }, {
      outputStyleNote: n => n.boundToPodId,
      skillNote: n => n.boundToPodId,
      repositoryNote: n => n.boundToOriginalPodId,
      subAgentNote: n => n.boundToPodId,
      commandNote: n => n.boundToOriginalPodId
    })

    const offset = calculateOffsets(boundingBox, targetPosition)

    const newPods = transformPods(pods, offset)

    const newOutputStyleNotes = transformNotes(
      outputStyleNotes,
      offset,
      n => n.boundToPodId,
      (note, position) => ({
        outputStyleId: note.outputStyleId,
        name: note.name,
        x: position.x,
        y: position.y,
        boundToOriginalPodId: note.boundToPodId,
        originalPosition: note.originalPosition,
      })
    )

    const newSkillNotes = transformNotes(
      skillNotes,
      offset,
      n => n.boundToPodId,
      (note, position) => ({
        skillId: note.skillId,
        name: note.name,
        x: position.x,
        y: position.y,
        boundToOriginalPodId: note.boundToPodId,
        originalPosition: note.originalPosition,
      })
    )

    const newRepositoryNotes = transformNotes(
      repositoryNotes,
      offset,
      n => n.boundToOriginalPodId,
      (note, position) => ({
        repositoryId: note.repositoryId,
        name: note.name,
        x: position.x,
        y: position.y,
        boundToOriginalPodId: note.boundToOriginalPodId,
        originalPosition: note.originalPosition,
      })
    )

    const newSubAgentNotes = transformNotes(
      subAgentNotes,
      offset,
      n => n.boundToPodId,
      (note, position) => ({
        subAgentId: note.subAgentId,
        name: note.name,
        x: position.x,
        y: position.y,
        boundToOriginalPodId: note.boundToPodId,
        originalPosition: note.originalPosition,
      })
    )

    const newCommandNotes = transformNotes(
      commandNotes,
      offset,
      n => n.boundToOriginalPodId,
      (note, position) => ({
        commandId: note.commandId,
        name: note.name,
        x: position.x,
        y: position.y,
        boundToOriginalPodId: note.boundToOriginalPodId,
        originalPosition: note.originalPosition,
      })
    )

    const newConnections = transformConnections(connections)

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

    // 統一事件監聽器會處理 Store 更新和 Toast 提示，這裡只處理選取邏輯
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
