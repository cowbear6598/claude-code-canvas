<script setup lang="ts">
import {computed, ref} from 'vue'
import type {SubAgentNote} from '@/types'
import {useSubAgentStore} from '@/stores/note'
import {useSlotDropTarget} from '@/composables/pod/useSlotDropTarget'

const props = defineProps<{
  podId: string
  boundNotes: SubAgentNote[]
}>()

const emit = defineEmits<{
  'note-dropped': [noteId: string]
}>()

const subAgentStore = useSubAgentStore()

const slotRef = ref<HTMLElement | null>(null)
const showMenu = ref(false)

const subAgentCount = computed(() => props.boundNotes.length)
const hasSubAgents = computed(() => subAgentCount.value > 0)

const {isDropTarget, isInserting} = useSlotDropTarget({
  slotRef,
  draggedNoteId: () => subAgentStore.draggedNoteId,
  validateDrop: (noteId: string) => {
    const draggedNote = subAgentStore.getNoteById(noteId)
    if (!draggedNote || draggedNote.boundToPodId !== null) return false

    return !(subAgentStore.isItemBoundToPod && subAgentStore.isItemBoundToPod(draggedNote.subAgentId, props.podId));
  },
  onDrop: (noteId: string) => {
    emit('note-dropped', noteId)
  }
})

const handleSlotHover = (): void => {
  if (hasSubAgents.value) {
    showMenu.value = true
  }
}

const handleSlotLeave = (): void => {
  showMenu.value = false
}
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
