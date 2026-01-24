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

const handleMouseDown = (e: MouseEvent) => {
  cleanupEventListeners()

  isDragging.value = true
  outputStyleStore.setDraggedNote(props.note.id)
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
  }

  const handleMouseUp = () => {
    isDragging.value = false
    outputStyleStore.setDraggedNote(null)
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
