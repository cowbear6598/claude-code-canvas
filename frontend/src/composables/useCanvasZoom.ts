import { useCanvasStore } from '@/stores/canvasStore'

export function useCanvasZoom() {
  const store = useCanvasStore()

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault()

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newZoom = store.viewport.zoom * delta

    store.zoomTo(newZoom, mouseX, mouseY)
  }

  return {
    handleWheel,
  }
}
