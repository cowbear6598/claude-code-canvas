import { onMounted, onUnmounted, ref } from 'vue'
import { useCanvasStore } from '@/stores/canvasStore'
import { useOutputStyleStore } from '@/stores/outputStyleStore'
import { useSkillStore } from '@/stores/skillStore'
import { useClipboardStore } from '@/stores/clipboardStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { websocketService } from '@/services/websocket'
import { generateRequestId } from '@/services/utils'
import { isEditingElement, isModifierKeyPressed, hasTextSelection } from '@/utils/domHelpers'
import { POD_WIDTH, POD_HEIGHT, NOTE_WIDTH, NOTE_HEIGHT, PASTE_TIMEOUT_MS } from '@/lib/constants'
import type {
  CanvasPasteResultPayload,
  SelectableElement,
  CopiedPod,
  CopiedOutputStyleNote,
  CopiedSkillNote,
  CopiedConnection
} from '@/types'

export function useCopyPaste() {
  const canvasStore = useCanvasStore()
  const outputStyleStore = useOutputStyleStore()
  const skillStore = useSkillStore()
  const clipboardStore = useClipboardStore()
  const connectionStore = useConnectionStore()

  const mousePosition = ref({ x: 0, y: 0 })

  const updateMousePosition = (event: MouseEvent): void => {
    mousePosition.value = { x: event.clientX, y: event.clientY }
  }

  const screenToCanvas = (screenX: number, screenY: number) => {
    const { offset, zoom } = canvasStore.viewport
    return {
      x: (screenX - offset.x) / zoom,
      y: (screenY - offset.y) / zoom
    }
  }

  const collectBoundNotes = (
    podId: string,
    outputStyleNotes: CopiedOutputStyleNote[],
    skillNotes: CopiedSkillNote[]
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

  const handleCopy = (event: KeyboardEvent): boolean => {
    const selectedElements = canvasStore.selection.selectedElements
    if (selectedElements.length === 0) return false

    event.preventDefault()

    const copiedPods: CopiedPod[] = []
    const copiedOutputStyleNotes: CopiedOutputStyleNote[] = []
    const copiedSkillNotes: CopiedSkillNote[] = []

    const selectedPodIds = new Set(
      selectedElements.filter(el => el.type === 'pod').map(el => el.id)
    )

    for (const element of selectedElements) {
      if (element.type === 'pod') {
        const pod = canvasStore.pods.find(p => p.id === element.id)
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
          })
        }
      }
    }

    for (const podId of selectedPodIds) {
      collectBoundNotes(podId, copiedOutputStyleNotes, copiedSkillNotes)
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
      }
    }

    // 收集內部連線（兩端 POD 都被選中的連線）
    const copiedConnections: CopiedConnection[] = []
    for (const connection of connectionStore.connections) {
      // 只複製兩端 POD 都在選中列表中的連線
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

    clipboardStore.setCopy(copiedPods, copiedOutputStyleNotes, copiedSkillNotes, copiedConnections)
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
    const { pods, outputStyleNotes, skillNotes, connections } = clipboardStore.getCopiedData()

    if (pods.length === 0 && outputStyleNotes.length === 0 && skillNotes.length === 0) {
      return { pods: [], outputStyleNotes: [], skillNotes: [], connections: [] }
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

    // 構建新的 connections
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
      connections: newConnections,
    }
  }

  const handlePaste = (event: KeyboardEvent): boolean => {
    if (clipboardStore.isEmpty) return false

    event.preventDefault()

    const canvasPos = screenToCanvas(mousePosition.value.x, mousePosition.value.y)
    const { pods, outputStyleNotes, skillNotes, connections } = calculatePastePositions(canvasPos)

    const requestId = generateRequestId()

    const handleCanvasPasteResult = (payload: CanvasPasteResultPayload) => {
      if (payload.requestId !== requestId) return

      websocketService.offCanvasPasteResult(handleCanvasPasteResult)

      if (payload.success) {
        for (const pod of payload.createdPods) {
          canvasStore.addPod(pod)
        }

        const createdPodIds = payload.createdPods.map(p => p.id)
        if (createdPodIds.length > 0) {
          websocketService.podJoinBatch({ podIds: createdPodIds })
        }

        for (const note of payload.createdOutputStyleNotes) {
          outputStyleStore.notes.push(note)
        }

        for (const note of payload.createdSkillNotes) {
          skillStore.notes.push(note)
        }

        // 將創建的連線加入 connectionStore
        for (const conn of payload.createdConnections) {
          connectionStore.connections.push({
            ...conn,
            createdAt: new Date(conn.createdAt),
            autoTrigger: conn.autoTrigger ?? false,
            status: 'inactive',
          })
        }

        const newSelectedElements: SelectableElement[] = [
          ...payload.createdPods.map(pod => ({ type: 'pod' as const, id: pod.id })),
          ...payload.createdOutputStyleNotes
            .filter(note => note.boundToPodId === null)
            .map(note => ({ type: 'outputStyleNote' as const, id: note.id })),
          ...payload.createdSkillNotes
            .filter(note => note.boundToPodId === null)
            .map(note => ({ type: 'skillNote' as const, id: note.id })),
        ]

        canvasStore.setSelectedElements(newSelectedElements)
      }
    }

    websocketService.onCanvasPasteResult(handleCanvasPasteResult)
    websocketService.canvasPaste({
      requestId,
      pods,
      outputStyleNotes,
      skillNotes,
      connections,
    })

    setTimeout(() => {
      websocketService.offCanvasPasteResult(handleCanvasPasteResult)
    }, PASTE_TIMEOUT_MS)

    return true
  }

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (!isModifierKeyPressed(event)) return
    if (isEditingElement()) return

    const key = event.key.toLowerCase()

    if (key === 'c') {
      // 如果有選取文字，讓瀏覽器處理原生複製
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
