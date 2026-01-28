<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { SubAgentNote } from '@/types'
import { useSubAgentStore } from '@/stores/note'

const props = defineProps<{
  podId: string
  boundNotes: SubAgentNote[]
}>()

const emit = defineEmits<{
  'note-dropped': [noteId: string]
}>()

const subAgentStore = useSubAgentStore()

const slotRef = ref<HTMLElement | null>(null)
const isDropTarget = ref(false)
const lastDraggedNoteId = ref<string | null>(null)
const isInserting = ref(false)
const showMenu = ref(false)

const subAgentCount = computed(() => props.boundNotes.length)
const hasSubAgents = computed(() => subAgentCount.value > 0)

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
  if (!isDropTarget.value || !noteId) return

  const draggedNote = subAgentStore.getNoteById(noteId)
  if (!draggedNote || draggedNote.boundToPodId !== null) return

  if (subAgentStore.isItemBoundToPod && subAgentStore.isItemBoundToPod(draggedNote.subAgentId, props.podId)) {
    return
  }

  isInserting.value = true
  emit('note-dropped', noteId)

  setTimeout(() => {
    isInserting.value = false
  }, 300)
}

const setupListeners = () => {
  mouseMoveHandler = checkDropTarget
  mouseUpHandler = () => {
    handleDrop()
    cleanupListeners()
  }

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
  isDropTarget.value = false
}

const handleSlotHover = () => {
  if (hasSubAgents.value) {
    showMenu.value = true
  }
}

const handleSlotLeave = () => {
  showMenu.value = false
}

watch(() => subAgentStore.draggedNoteId, (newVal) => {
  if (newVal) {
    lastDraggedNoteId.value = newVal
    setupListeners()
  } else {
    cleanupListeners()
  }
})

onMounted(() => {
  if (subAgentStore.draggedNoteId) {
    lastDraggedNoteId.value = subAgentStore.draggedNoteId
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
    class="pod-subagent-slot"
    :class="{
      'drop-target': isDropTarget,
      'has-notes': hasSubAgents,
      inserting: isInserting
    }"
    @mouseenter="handleSlotHover"
    @mouseleave="handleSlotLeave"
  >
    <span
      class="text-xs font-mono"
      :class="{ 'opacity-50': !hasSubAgents }"
    >
      <template v-if="hasSubAgents">({{ subAgentCount }}) </template>SubAgents
    </span>

    <div
      v-if="showMenu && hasSubAgents"
      class="pod-subagent-menu"
      @wheel.stop.passive
    >
      <div class="pod-subagent-menu-scrollable">
        <div
          v-for="note in boundNotes"
          :key="note.id"
          class="pod-subagent-menu-item"
        >
          {{ note.name }}
        </div>
      </div>
    </div>
  </div>
</template>
