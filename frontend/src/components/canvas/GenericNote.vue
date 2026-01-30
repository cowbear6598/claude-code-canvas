<script setup lang="ts">
import { ref, onUnmounted, computed } from 'vue'
import type { BaseNote } from '@/types'
import { useViewportStore, useSelectionStore } from '@/stores/pod'
import { useOutputStyleStore, useSkillStore, useSubAgentStore, useRepositoryStore, useCommandStore } from '@/stores/note'
import { useBatchDrag } from '@/composables/canvas'

type NoteType = 'outputStyle' | 'skill' | 'subAgent' | 'repository' | 'command'

interface Props {
  note: BaseNote
  noteType: NoteType
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'drag-end': [data: { noteId: string; x: number; y: number }]
  'drag-move': [data: { noteId: string; screenX: number; screenY: number }]
  'drag-complete': [data: { noteId: string; isOverTrash: boolean; startX: number; startY: number }]
}>()

const cssClassMap: Record<NoteType, string> = {
  outputStyle: 'output-style-note',
  skill: 'skill-note',
  subAgent: 'subagent-note',
  repository: 'repository-note',
  command: 'command-note'
}

const selectionTypeMap = {
  outputStyle: 'outputStyleNote',
  skill: 'skillNote',
  subAgent: 'subAgentNote',
  repository: 'repositoryNote',
  command: 'commandNote'
} as const

const viewportStore = useViewportStore()
const selectionStore = useSelectionStore()
const outputStyleStore = useOutputStyleStore()
const skillStore = useSkillStore()
const subAgentStore = useSubAgentStore()
const repositoryStore = useRepositoryStore()
const commandStore = useCommandStore()
const { startBatchDrag, isElementSelected } = useBatchDrag()

const noteStore = computed(() => {
  switch (props.noteType) {
    case 'outputStyle':
      return outputStyleStore
    case 'skill':
      return skillStore
    case 'subAgent':
      return subAgentStore
    case 'repository':
      return repositoryStore
    case 'command':
      return commandStore
    default:
      return outputStyleStore
  }
})

const isDragging = ref(false)
const isAnimating = computed(() => noteStore.value.isNoteAnimating(props.note.id))
const isSelected = computed(() => {
  switch (props.noteType) {
    case 'outputStyle':
      return selectionStore.selectedOutputStyleNoteIds.includes(props.note.id)
    case 'skill':
      return selectionStore.selectedSkillNoteIds.includes(props.note.id)
    case 'subAgent':
      return selectionStore.selectedSubAgentNoteIds.includes(props.note.id)
    case 'repository':
      return selectionStore.selectedRepositoryNoteIds.includes(props.note.id)
    case 'command':
      return selectionStore.selectedCommandNoteIds.includes(props.note.id)
    default:
      return false
  }
})

const dragRef = ref<{
  startX: number
  startY: number
  noteX: number
  noteY: number
} | null>(null)
const startPosition = ref<{ x: number; y: number } | null>(null)

let currentMouseMoveHandler: ((e: MouseEvent) => void) | null = null
let currentMouseUpHandler: (() => void) | null = null

const cleanupEventListeners = (): void => {
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
const handleMouseDown = (e: MouseEvent): void => {
  const selectionType = selectionTypeMap[props.noteType]

  if (isElementSelected(selectionType, props.note.id) && selectionStore.selectedElements.length > 1) {
    if (startBatchDrag(e)) {
      return
    }
  }

  if (!isElementSelected(selectionType, props.note.id)) {
    selectionStore.setSelectedElements([{ type: selectionType, id: props.note.id }])
  }

  cleanupEventListeners()

  isDragging.value = true
  noteStore.value.setDraggedNote(props.note.id)
  noteStore.value.setIsDraggingNote(true)

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

  const handleMouseMove = (moveEvent: MouseEvent): void => {
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

  const handleMouseUp = (): void => {
    emit('drag-complete', {
      noteId: props.note.id,
      isOverTrash: noteStore.value.isOverTrash,
      startX: startPosition.value?.x ?? props.note.x,
      startY: startPosition.value?.y ?? props.note.y,
    })

    isDragging.value = false
    noteStore.value.setDraggedNote(null)
    noteStore.value.setIsDraggingNote(false)
    startPosition.value = null
    dragRef.value = null
    cleanupEventListeners()
  }

  currentMouseMoveHandler = handleMouseMove
  currentMouseUpHandler = handleMouseUp

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

const cssClass = computed(() => cssClassMap[props.noteType])
const textClass = computed(() => `${cssClassMap[props.noteType]}-text`)
</script>

<template>
  <div
    :class="[cssClass, { dragging: isDragging, animating: isAnimating, selected: isSelected }]"
    :style="{
      left: `${note.x}px`,
      top: `${note.y}px`,
    }"
    @mousedown="handleMouseDown"
  >
    <div :class="textClass">
      {{ note.name }}
    </div>
  </div>
</template>
