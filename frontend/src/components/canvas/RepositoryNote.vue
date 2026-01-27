<script setup lang="ts">
import {ref, onUnmounted, computed} from 'vue'
import type {RepositoryNote} from '@/types'
import {useViewportStore, useSelectionStore} from '@/stores/pod'
import {useRepositoryStore} from '@/stores/note'
import {useBatchDrag} from '@/composables/canvas'

const props = defineProps<{
  note: RepositoryNote
}>()

const emit = defineEmits<{
  'drag-end': [data: {noteId: string; x: number; y: number}]
  'drag-move': [data: {noteId: string; screenX: number; screenY: number}]
  'drag-complete': [data: {noteId: string; isOverTrash: boolean; startX: number; startY: number}]
}>()

const viewportStore = useViewportStore()
const selectionStore = useSelectionStore()
const repositoryStore = useRepositoryStore()
const {startBatchDrag, isElementSelected} = useBatchDrag()

const isDragging = ref(false)
const isAnimating = computed(() => repositoryStore.isNoteAnimating(props.note.id))
const isSelected = computed(() =>
  selectionStore.selectedRepositoryNoteIds.includes(props.note.id)
)
const dragRef = ref<{
  startX: number
  startY: number
  noteX: number
  noteY: number
} | null>(null)
const startPosition = ref<{x: number; y: number} | null>(null)

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
  if (isElementSelected('repositoryNote', props.note.id) && selectionStore.selectedElements.length > 1) {
    if (startBatchDrag(e)) {
      return
    }
  }

  if (!isElementSelected('repositoryNote', props.note.id)) {
    selectionStore.setSelectedElements([{type: 'repositoryNote', id: props.note.id}])
  }

  cleanupEventListeners()

  isDragging.value = true
  repositoryStore.setDraggedNote(props.note.id)
  repositoryStore.setIsDraggingNote(true)

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

    const dx = (moveEvent.clientX - dragRef.value.startX) / viewportStore.zoom
    const dy = (moveEvent.clientY - dragRef.value.startY) / viewportStore.zoom

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
      isOverTrash: repositoryStore.isOverTrash,
      startX: startPosition.value?.x ?? props.note.x,
      startY: startPosition.value?.y ?? props.note.y,
    })

    isDragging.value = false
    repositoryStore.setDraggedNote(null)
    repositoryStore.setIsDraggingNote(false)
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
    class="repository-note"
    :class="{ dragging: isDragging, animating: isAnimating, selected: isSelected }"
    :style="{
      left: `${note.x}px`,
      top: `${note.y}px`,
    }"
    @mousedown="handleMouseDown"
  >
    <div class="repository-note-text">
      {{ note.name }}
    </div>
  </div>
</template>
