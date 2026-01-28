<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { SkillNote } from '@/types'
import { useSkillStore } from '@/stores/note'

const props = defineProps<{
  podId: string
  boundNotes: SkillNote[]
}>()

const emit = defineEmits<{
  'note-dropped': [noteId: string]
}>()

const skillStore = useSkillStore()

const slotRef = ref<HTMLElement | null>(null)
const isDropTarget = ref(false)
const lastDraggedNoteId = ref<string | null>(null)
const isInserting = ref(false)
const showMenu = ref(false)

const skillCount = computed(() => props.boundNotes.length)
const hasSkills = computed(() => skillCount.value > 0)

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

  const draggedNote = skillStore.getNoteById(noteId)
  if (!draggedNote || draggedNote.boundToPodId !== null) return

  if (skillStore.isSkillBoundToPod(draggedNote.skillId, props.podId)) {
    console.warn('[PodSkillSlot] Skill already bound to this pod:', draggedNote.skillId)
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
  if (hasSkills.value) {
    showMenu.value = true
  }
}

const handleSlotLeave = () => {
  showMenu.value = false
}

watch(() => skillStore.draggedNoteId, (newVal) => {
  if (newVal) {
    lastDraggedNoteId.value = newVal
    setupListeners()
  } else {
    cleanupListeners()
  }
})

onMounted(() => {
  if (skillStore.draggedNoteId) {
    lastDraggedNoteId.value = skillStore.draggedNoteId
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
    class="pod-skill-slot"
    :class="{
      'drop-target': isDropTarget,
      'has-notes': hasSkills,
      inserting: isInserting
    }"
    @mouseenter="handleSlotHover"
    @mouseleave="handleSlotLeave"
  >
    <span
      class="text-xs font-mono"
      :class="{ 'opacity-50': !hasSkills }"
    >
      <template v-if="hasSkills">({{ skillCount }}) </template>Skills
    </span>

    <div
      v-if="showMenu && hasSkills"
      class="pod-skill-menu"
      @wheel.stop.passive
    >
      <div class="pod-skill-menu-scrollable">
        <div
          v-for="note in boundNotes"
          :key="note.id"
          class="pod-skill-menu-item"
        >
          {{ note.name }}
        </div>
      </div>
    </div>
  </div>
</template>
