import { ref, type Ref } from 'vue'

interface DraggableOptions {
  initialX?: number
  initialY?: number
  excludeSelectors?: string[]
}

export function useDraggable(
  _targetRef: Ref<HTMLElement | null>,
  options: DraggableOptions = {}
) {
  const { initialX = 0, initialY = 0, excludeSelectors = [] } = options

  const isDragging = ref(false)
  const position = ref({ x: initialX, y: initialY })

  let startX = 0
  let startY = 0
  let offsetX = 0
  let offsetY = 0

  const onMouseDown = (event: MouseEvent) => {
    const target = event.target as HTMLElement

    const isExcluded = excludeSelectors.some((selector) =>
      target.closest(selector)
    )

    if (isExcluded) {
      return
    }

    isDragging.value = true
    startX = event.clientX
    startY = event.clientY
    offsetX = position.value.x
    offsetY = position.value.y

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const onMouseMove = (event: MouseEvent) => {
    if (!isDragging.value) return

    const deltaX = event.clientX - startX
    const deltaY = event.clientY - startY

    position.value = {
      x: offsetX + deltaX,
      y: offsetY + deltaY,
    }
  }

  const onMouseUp = () => {
    isDragging.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  return {
    isDragging,
    position,
    onMouseDown,
  }
}
