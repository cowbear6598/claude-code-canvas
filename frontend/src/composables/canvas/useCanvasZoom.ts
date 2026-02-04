import { useCanvasContext } from './useCanvasContext'

export function useCanvasZoom(): {
  handleWheel: (e: WheelEvent) => void
} {
  const { viewportStore } = useCanvasContext()

  const handleWheel = (e: WheelEvent): void => {
    e.preventDefault()

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newZoom = viewportStore.zoom * delta

    viewportStore.zoomTo(newZoom, mouseX, mouseY)
  }

  return {
    handleWheel,
  }
}
