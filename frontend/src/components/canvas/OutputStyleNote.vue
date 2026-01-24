<script setup lang="ts">
import { ref, onUnmounted, computed } from 'vue'
import type { OutputStyleNote } from '@/types'
import { useCanvasStore } from '@/stores/canvasStore'
import { useOutputStyleStore } from '@/stores/outputStyleStore'

const props = defineProps<{
  note: OutputStyleNote
}>()

const emit = defineEmits<{
  'drag-end': [data: { noteId: string; x: number; y: number }]
  'drag-move': [data: { noteId: string; screenX: number; screenY: number }]
  'drag-complete': [data: { noteId: string; isOverTrash: boolean; startX: number; startY: number }]
}>()

const canvasStore = useCanvasStore()
const outputStyleStore = useOutputStyleStore()

const isDragging = ref(false)
const isAnimating = computed(() => outputStyleStore.isNoteAnimating(props.note.id))
const dragRef = ref<{
  startX: number
  startY: number
  noteX: number
  noteY: number
} | null>(null)
const startPosition = ref<{ x: number; y: number } | null>(null)

let currentMouseMoveHandler: ((e: MouseEvent) => void) | null = null
let currentMouseUpHandler: (() => void) | null = null

const cleanupEventListeners = () => {
  if (currentMouseMoveHandler) {
    document.removeEventListener('mousemove', currentMouseMoveHandler)
    currentMouseMoveHandler = null
  }
  if (currentMouseUpHandler) {
    document.removeEventListener('mouseup', currentMouseUpHandler)
    currentMouseUpHandler = null
  }
}

onUnmounted(() => {
  cleanupEventListeners()
})

// 使用 document 級別的事件監聽器而非 Vue 事件系統的原因：
// 1. 需要追蹤全局 mousemove/mouseup 事件（不受組件邊界限制）
// 2. 需要計算相對於 viewport 的坐標變化
// 3. 需要在 unmount 時精確清理監聽器以防記憶體洩漏
const handleMouseDown = (e: MouseEvent) => {
  cleanupEventListeners()

  isDragging.value = true
  outputStyleStore.setDraggedNote(props.note.id)
  outputStyleStore.setIsDraggingNote(true)

  startPosition.value = {
    x: props.note.x,
    y: props.note.y,
  }

  dragRef.value = {
    startX: e.clientX,
    startY: e.clientY,
    noteX: props.note.x,
    noteY: props.note.y,
  }

  const handleMouseMove = (moveEvent: MouseEvent) => {
    if (!dragRef.value) return
    const dx = (moveEvent.clientX - dragRef.value.startX) / canvasStore.viewport.zoom
    const dy = (moveEvent.clientY - dragRef.value.startY) / canvasStore.viewport.zoom

    emit('drag-end', {
      noteId: props.note.id,
      x: dragRef.value.noteX + dx,
      y: dragRef.value.noteY + dy,
    })

    emit('drag-move', {
      noteId: props.note.id,
      screenX: moveEvent.clientX,
      screenY: moveEvent.clientY,
    })
  }

  const handleMouseUp = () => {
    emit('drag-complete', {
      noteId: props.note.id,
      isOverTrash: outputStyleStore.isOverTrash,
      startX: startPosition.value?.x ?? props.note.x,
      startY: startPosition.value?.y ?? props.note.y,
    })

    isDragging.value = false
    outputStyleStore.setDraggedNote(null)
    outputStyleStore.setIsDraggingNote(false)
    startPosition.value = null
    dragRef.value = null
    cleanupEventListeners()
  }

  currentMouseMoveHandler = handleMouseMove
  currentMouseUpHandler = handleMouseUp

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}
</script>

<template>
  <div
    class="output-style-note"
    :class="{ dragging: isDragging, animating: isAnimating }"
    :style="{
      left: `${note.x}px`,
      top: `${note.y}px`,
    }"
    @mousedown="handleMouseDown"
  >
    <div class="output-style-note-text">
      {{ note.name }}
    </div>
  </div>
</template>
