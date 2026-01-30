<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import type { RepositoryNote } from '@/types'
import { useRepositoryStore } from '@/stores/note'
import { useViewportStore } from '@/stores/pod'

const props = defineProps<{
  podId: string
  boundNote: RepositoryNote | undefined
  podRotation?: number
}>()

const emit = defineEmits<{
  'note-dropped': [noteId: string]
  'note-removed': []
}>()

const repositoryStore = useRepositoryStore()
const viewportStore = useViewportStore()
const slotRef = ref<HTMLElement | null>(null)
const isDropTarget = ref(false)
const lastDraggedNoteId = ref<string | null>(null)
const isEjecting = ref(false)
const isInserting = ref(false)

let mouseMoveHandler: ((e: MouseEvent) => void) | null = null
let mouseUpHandler: (() => void) | null = null

const checkDropTarget = (e: MouseEvent): void => {
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

const handleDrop = (): void => {
  const noteId = lastDraggedNoteId.value
  if (!isDropTarget.value || !noteId) {
    isDropTarget.value = false
    return
  }

  const draggedNote = repositoryStore.getNoteById(noteId)

  if (draggedNote && !draggedNote.boundToPodId) {
    isInserting.value = true
    emit('note-dropped', noteId)
    setTimeout(() => {
      isInserting.value = false
    }, 300)
  }

  isDropTarget.value = false
}

const setupListeners = (): void => {
  mouseMoveHandler = checkDropTarget
  mouseUpHandler = handleDrop
  document.addEventListener('mousemove', mouseMoveHandler)
  document.addEventListener('mouseup', mouseUpHandler, {capture: true})
}

const cleanupListeners = (): void => {
  if (mouseMoveHandler) {
    document.removeEventListener('mousemove', mouseMoveHandler)
    mouseMoveHandler = null
  }
  if (mouseUpHandler) {
    document.removeEventListener('mouseup', mouseUpHandler, {capture: true})
    mouseUpHandler = null
  }
}

const handleSlotClick = async (e: MouseEvent): Promise<void> => {
  if (!props.boundNote || isEjecting.value) return

  e.stopPropagation()
  e.preventDefault()

  const noteId = props.boundNote.id
  const note = repositoryStore.getNoteById(noteId)
  if (!note) return

  const slotElement = slotRef.value
  if (!slotElement) return

  const slotWidth = slotElement.getBoundingClientRect().width
  const zoom = viewportStore.zoom

  const podElement = slotElement.closest('.pod-with-notch')
  if (!podElement) return

  const podRect = podElement.getBoundingClientRect()
  const slotRect = slotElement.getBoundingClientRect()
  const viewportOffset = viewportStore.offset

  const podCenterX = (podRect.right - viewportOffset.x) / zoom
  const podCenterY = (slotRect.top - viewportOffset.y) / zoom

  const extraDistance = 30
  const baseX = slotWidth / zoom + extraDistance
  const baseY = 0

  const rotation = props.podRotation || 0
  const radians = rotation * Math.PI / 180

  const rotatedX = baseX * Math.cos(radians) - baseY * Math.sin(radians)
  const rotatedY = baseX * Math.sin(radians) + baseY * Math.cos(radians)

  const ejectX = podCenterX + rotatedX
  const ejectY = podCenterY + rotatedY

  isEjecting.value = true
  repositoryStore.setNoteAnimating(noteId, true)

  emit('note-removed')

  await repositoryStore.unbindFromPod(props.podId, false)
  await repositoryStore.updateNotePosition(noteId, ejectX, ejectY)

  setTimeout(() => {
    isEjecting.value = false
    repositoryStore.setNoteAnimating(noteId, false)
  }, 300)
}

watch(() => repositoryStore.draggedNoteId, (newVal) => {
  if (newVal) {
    lastDraggedNoteId.value = newVal
    setupListeners()
    return
  }

  cleanupListeners()
  isDropTarget.value = false
})

onMounted(() => {
  if (repositoryStore.draggedNoteId) {
    lastDraggedNoteId.value = repositoryStore.draggedNoteId
    setupListeners()
  }
})

onUnmounted(() => {
  cleanupListeners()
})
</script>

<template>
  <div
    ref="slotRef"
    class="pod-repository-slot"
    :class="{
      'drop-target': isDropTarget,
      'has-note': boundNote !== undefined,
      'ejecting': isEjecting,
      'inserting': isInserting
    }"
    @click="handleSlotClick"
  >
    <template v-if="boundNote">
      <span class="text-xs font-mono">{{ boundNote.name }}</span>
    </template>
    <template v-else>
      <span class="text-xs font-mono opacity-50">Repo</span>
    </template>
  </div>
</template>
