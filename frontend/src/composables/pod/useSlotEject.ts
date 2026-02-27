import type { Ref } from 'vue'
import { ref } from 'vue'

interface Position {
  x: number
  y: number
}

interface NotePosition extends Position {
  id: string
}

export interface UseSlotEjectOptions {
  slotRef: Ref<HTMLElement | null>
  podRotation: () => number
  getNoteById: (id: string) => NotePosition | undefined
  setNoteAnimating: (noteId: string, animating: boolean) => void
  unbindFromPod: (podId: string, returnToOriginal: boolean, targetPosition?: Position) => Promise<void>
  getViewportZoom: () => number
  getViewportOffset: () => { x: number; y: number }
}

interface UseSlotEjectReturn {
  isEjecting: Ref<boolean>
  handleSlotClick: (e: MouseEvent, boundNoteId: string, podId: string, onRemoved: () => void) => Promise<void>
}

export function useSlotEject(options: UseSlotEjectOptions): UseSlotEjectReturn {
  const {
    slotRef,
    podRotation,
    getNoteById,
    setNoteAnimating,
    unbindFromPod,
    getViewportZoom,
    getViewportOffset
  } = options

  const isEjecting = ref(false)

  const handleSlotClick = async (
    e: MouseEvent,
    boundNoteId: string,
    podId: string,
    onRemoved: () => void
  ): Promise<void> => {
    if (isEjecting.value) return

    e.stopPropagation()
    e.preventDefault()

    const note = getNoteById(boundNoteId)
    if (!note) return

    const slotElement = slotRef.value
    if (!slotElement) return

    const zoom = getViewportZoom()

    const podElement = slotElement.closest('.pod-with-notch')
    if (!podElement) return

    const podRect = podElement.getBoundingClientRect()
    const slotRect = slotElement.getBoundingClientRect()
    const viewportOffset = getViewportOffset()

    const podCenterX = (podRect.right - viewportOffset.x) / zoom
    const podCenterY = (slotRect.top - viewportOffset.y) / zoom

    const baseX = 30
    const baseY = 0

    const rotation = podRotation()
    const radians = rotation * Math.PI / 180

    const rotatedX = baseX * Math.cos(radians) - baseY * Math.sin(radians)
    const rotatedY = baseX * Math.sin(radians) + baseY * Math.cos(radians)

    const ejectX = podCenterX + rotatedX
    const ejectY = podCenterY + rotatedY

    isEjecting.value = true
    setNoteAnimating(boundNoteId, true)

    await unbindFromPod(podId, false, { x: ejectX, y: ejectY })

    onRemoved()

    setTimeout(() => {
      isEjecting.value = false
      setNoteAnimating(boundNoteId, false)
    }, 300)
  }

  return {
    isEjecting,
    handleSlotClick
  }
}
