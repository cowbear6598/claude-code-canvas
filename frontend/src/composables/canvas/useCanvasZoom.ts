import { useCanvasContext } from './useCanvasContext'

const ZOOM_STEP_FACTOR = 0.1
const ZOOM_OUT_FACTOR = 1 - ZOOM_STEP_FACTOR
const ZOOM_IN_FACTOR = 1 + ZOOM_STEP_FACTOR

export function useCanvasZoom(): {
  handleWheel: (e: WheelEvent) => void
} {
  const { viewportStore } = useCanvasContext()

  const handleWheel = (e: WheelEvent): void => {
    e.preventDefault()

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const delta = e.deltaY > 0 ? ZOOM_OUT_FACTOR : ZOOM_IN_FACTOR
    const newZoom = viewportStore.zoom * delta

    viewportStore.zoomTo(newZoom, mouseX, mouseY)
  }

  return {
    handleWheel,
  }
}
