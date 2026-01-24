<script setup lang="ts">
import {onMounted, onUnmounted, ref, watch} from 'vue'
import type {OutputStyleNote} from '@/types'
import {useOutputStyleStore} from '@/stores/outputStyleStore'
import {useCanvasStore} from '@/stores/canvasStore'

const props = defineProps<{
  podId: string
  boundNote: OutputStyleNote | undefined
}>()

const emit = defineEmits<{
  'note-dropped': [noteId: string]
  'note-removed': []
}>()

const outputStyleStore = useOutputStyleStore()
const canvasStore = useCanvasStore()
const slotRef = ref<HTMLElement | null>(null)
const isDropTarget = ref(false)
const lastDraggedNoteId = ref<string | null>(null)
const isDraggingOut = ref(false)

let mouseMoveHandler: ((e: MouseEvent) => void) | null = null
let mouseUpHandler: (() => void) | null = null
let dragOutMoveHandler: ((e: MouseEvent) => void) | null = null
let dragOutUpHandler: (() => void) | null = null

const checkDropTarget = (e: MouseEvent) => {
  if (!slotRef.value) {
    isDropTarget.value = false
    return
  }

  const rect = slotRef.value.getBoundingClientRect()

  isDropTarget.value = e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
}

const handleDrop = () => {
  const noteId = lastDraggedNoteId.value
  if (isDropTarget.value && noteId) {
    const draggedNote = outputStyleStore.getNoteById(noteId)

    if (draggedNote && !draggedNote.boundToPodId) {
      emit('note-dropped', noteId)
    }
  }
  isDropTarget.value = false
}

const setupListeners = () => {
  mouseMoveHandler = checkDropTarget
  mouseUpHandler = handleDrop
  document.addEventListener('mousemove', mouseMoveHandler)
  document.addEventListener('mouseup', mouseUpHandler, { capture: true })
}

const cleanupListeners = () => {
  if (mouseMoveHandler) {
    document.removeEventListener('mousemove', mouseMoveHandler)
    mouseMoveHandler = null
  }
  if (mouseUpHandler) {
    document.removeEventListener('mouseup', mouseUpHandler, { capture: true })
    mouseUpHandler = null
  }
}

const cleanupDragOutListeners = () => {
  if (dragOutMoveHandler) {
    document.removeEventListener('mousemove', dragOutMoveHandler)
    dragOutMoveHandler = null
  }
  if (dragOutUpHandler) {
    document.removeEventListener('mouseup', dragOutUpHandler)
    dragOutUpHandler = null
  }
}

const handleSlotMouseDown = (e: MouseEvent) => {
  if (!props.boundNote) return

  e.stopPropagation()
  isDraggingOut.value = true

  const noteId = props.boundNote.id
  const startX = e.clientX
  const startY = e.clientY
  const originalX = props.boundNote.originalPosition?.x ?? props.boundNote.x
  const originalY = props.boundNote.originalPosition?.y ?? props.boundNote.y

  emit('note-removed')

  setTimeout(() => {
    const note = outputStyleStore.getNoteById(noteId)
    if (note) {
      outputStyleStore.setDraggedNote(noteId)

      dragOutMoveHandler = (moveEvent: MouseEvent) => {
        const dx = (moveEvent.clientX - startX) / canvasStore.viewport.zoom
        const dy = (moveEvent.clientY - startY) / canvasStore.viewport.zoom
        outputStyleStore.updateNotePosition(noteId, originalX + dx, originalY + dy)
      }

      dragOutUpHandler = () => {
        isDraggingOut.value = false
        outputStyleStore.setDraggedNote(null)
        cleanupDragOutListeners()
      }

      document.addEventListener('mousemove', dragOutMoveHandler)
      document.addEventListener('mouseup', dragOutUpHandler)
    }
  }, 50)
}

watch(() => outputStyleStore.draggedNoteId, (newVal) => {
  if (newVal && !isDraggingOut.value) {
    lastDraggedNoteId.value = newVal
    setupListeners()
  } else if (!newVal) {
    cleanupListeners()
    isDropTarget.value = false
  }
})

onMounted(() => {
  if (outputStyleStore.draggedNoteId) {
    lastDraggedNoteId.value = outputStyleStore.draggedNoteId
    setupListeners()
  }
})

onUnmounted(() => {
  cleanupListeners()
  cleanupDragOutListeners()
})
</script>

<template>
  <div
    ref="slotRef"
    class="pod-output-style-slot"
    :class="{
      'drop-target': isDropTarget,
      'has-note': boundNote !== undefined,
      'dragging-out': isDraggingOut
    }"
    @mousedown="handleSlotMouseDown"
  >
    <template v-if="boundNote">
      <span class="text-xs font-mono">{{ boundNote.name }}</span>
    </template>
    <template v-else>
      <span class="text-xs font-mono opacity-50">Style</span>
    </template>
  </div>
</template>
