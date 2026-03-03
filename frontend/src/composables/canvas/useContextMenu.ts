import { ref, type Ref } from 'vue'

interface ContextMenuPosition {
  x: number
  y: number
}

interface ContextMenuState<T> {
  visible: boolean
  position: ContextMenuPosition
  data: T
}

export function useContextMenu<T>(defaultData: T): {
  state: Ref<ContextMenuState<T>>
  open: (event: MouseEvent, data: T) => void
  close: () => void
} {
  const state: Ref<ContextMenuState<T>> = ref({
    visible: false,
    position: { x: 0, y: 0 },
    data: defaultData,
  }) as Ref<ContextMenuState<T>>

  function open(event: MouseEvent, data: T): void {
    state.value = {
      visible: true,
      position: { x: event.clientX, y: event.clientY },
      data,
    }
  }

  function close(): void {
    state.value.visible = false
  }

  return { state, open, close }
}
