<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import type { SubAgentNote } from '@/types'
import { useViewportStore, useSelectionStore } from '@/stores/pod'
import { useSubAgentStore } from '@/stores/note'
import { useBatchDrag } from '@/composables/canvas'

const props = defineProps<{
  note: SubAgentNote
}>()

const emit = defineEmits<{
  'drag-end': [data: { noteId: string; x: number; y: number }]
  'drag-move': [data: { noteId: string; screenX: number; screenY: number }]
  'drag-complete': [data: { noteId: string; isOverTrash: boolean; startX: number; startY: number }]
}>()

const viewportStore = useViewportStore()
const selectionStore = useSelectionStore()
const subAgentStore = useSubAgentStore()
const { startBatchDrag, isElementSelected } = useBatchDrag()

const isDragging = ref(false)
const isAnimating = computed(() => subAgentStore.isNoteAnimating(props.note.id))
const isSelected = computed(() =>
  selectionStore.selectedSubAgentNoteIds.includes(props.note.id)
)
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
  // 檢查此 Note 是否在選中列表中
  if (isElementSelected('subAgentNote', props.note.id) && selectionStore.selectedElements.length > 1) {
    if (startBatchDrag(e)) {
      return
    }
  }

  // 點擊時選取當前 Note（若未選取則清除其他並選取當前）
  if (!isElementSelected('subAgentNote', props.note.id)) {
    selectionStore.setSelectedElements([{ type: 'subAgentNote', id: props.note.id }])
  }

  cleanupEventListeners()

  isDragging.value = true
  subAgentStore.setDraggedNote(props.note.id)
  subAgentStore.setIsDraggingNote(true)

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
      isOverTrash: subAgentStore.isOverTrash,
      startX: startPosition.value?.x ?? props.note.x,
      startY: startPosition.value?.y ?? props.note.y,
    })

    isDragging.value = false
    subAgentStore.setDraggedNote(null)
    subAgentStore.setIsDraggingNote(false)
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
    class="subagent-note"
    :class="{ dragging: isDragging, animating: isAnimating, selected: isSelected }"
    :style="{
      left: `${note.x}px`,
      top: `${note.y}px`,
    }"
    @mousedown="handleMouseDown"
  >
    <div class="subagent-note-text">
      {{ note.name }}
    </div>
  </div>
</template>
