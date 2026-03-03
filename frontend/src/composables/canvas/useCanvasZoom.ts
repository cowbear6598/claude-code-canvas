import { useCanvasContext } from './useCanvasContext'

const ZOOM_STEP_FACTOR = 0.1
const ZOOM_OUT_FACTOR = 1 - ZOOM_STEP_FACTOR
const ZOOM_IN_FACTOR = 1 + ZOOM_STEP_FACTOR

export function useCanvasZoom(): {
  handleWheel: (wheelEvent: WheelEvent) => void
} {
  const { viewportStore } = useCanvasContext()

  const handleWheel = (wheelEvent: WheelEvent): void => {
    wheelEvent.preventDefault()

    const rect = (wheelEvent.currentTarget as HTMLElement).getBoundingClientRect()
    const mouseX = wheelEvent.clientX - rect.left
    const mouseY = wheelEvent.clientY - rect.top

    const delta = wheelEvent.deltaY > 0 ? ZOOM_OUT_FACTOR : ZOOM_IN_FACTOR
    const newZoom = viewportStore.zoom * delta

    viewportStore.zoomTo(newZoom, mouseX, mouseY)
  }

  return {
    handleWheel,
  }
}
