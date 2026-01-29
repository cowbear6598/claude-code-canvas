<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import type { CommandNote } from '@/types'
import { useCommandStore } from '@/stores/note'
import { useViewportStore } from '@/stores/pod'

const props = defineProps<{
  podId: string
  boundNote: CommandNote | undefined
  podRotation?: number
}>()

const emit = defineEmits<{
  'note-dropped': [noteId: string]
  'note-removed': []
}>()

const commandStore = useCommandStore()
const viewportStore = useViewportStore()
const slotRef = ref<HTMLElement | null>(null)
const isDropTarget = ref(false)
const lastDraggedNoteId = ref<string | null>(null)
const isEjecting = ref(false)
const isInserting = ref(false)

let mouseMoveHandler: ((e: MouseEvent) => void) | null = null
let mouseUpHandler: (() => void) | null = null

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
  if (!isDropTarget.value || !noteId) {
    isDropTarget.value = false
    return
  }

  const draggedNote = commandStore.getNoteById(noteId)

  if (draggedNote && !draggedNote.boundToPodId) {
    isInserting.value = true
    emit('note-dropped', noteId)
    setTimeout(() => {
      isInserting.value = false
    }, 300)
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

const handleSlotClick = async (e: MouseEvent) => {
  if (!props.boundNote || isEjecting.value) return

  e.stopPropagation()
  e.preventDefault()

  const noteId = props.boundNote.id
  const note = commandStore.getNoteById(noteId)

  if (!note) return

  const slotElement = slotRef.value
  if (!slotElement) return

  const slotHeight = slotElement.getBoundingClientRect().height
  const zoom = viewportStore.zoom

  const podElement = slotElement.closest('.pod-with-notch')
  if (!podElement) return

  const podRect = podElement.getBoundingClientRect()
  const viewportOffset = viewportStore.offset

  const podCenterX = (podRect.left - viewportOffset.x) / zoom
  const podCenterY = (podRect.top - viewportOffset.y + 12) / zoom

  const extraDistance = 30
  const ejectDistance = slotHeight / zoom + extraDistance

  const baseX = 0
  const baseY = -ejectDistance

  const rotation = props.podRotation || 0
  const radians = rotation * Math.PI / 180

  const rotatedX = baseX * Math.cos(radians) - baseY * Math.sin(radians)
  const rotatedY = baseX * Math.sin(radians) + baseY * Math.cos(radians)

  const ejectX = podCenterX + rotatedX
  const ejectY = podCenterY + rotatedY

  isEjecting.value = true
  commandStore.setNoteAnimating(noteId, true)

  emit('note-removed')

  await commandStore.unbindFromPod(props.podId, false)

  await commandStore.updateNotePosition(noteId, ejectX, ejectY)

  setTimeout(() => {
    isEjecting.value = false
    commandStore.setNoteAnimating(noteId, false)
  }, 300)
}

watch(() => commandStore.draggedNoteId, (newVal) => {
  if (newVal) {
    lastDraggedNoteId.value = newVal
    setupListeners()
    return
  }

  cleanupListeners()
  isDropTarget.value = false
})

onMounted(() => {
  if (commandStore.draggedNoteId) {
    lastDraggedNoteId.value = commandStore.draggedNoteId
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
    class="pod-command-slot"
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
      <span class="text-xs font-mono opacity-50">command</span>
    </template>
  </div>
</template>
