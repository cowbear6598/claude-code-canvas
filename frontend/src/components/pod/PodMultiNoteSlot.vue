<script setup lang="ts">
import { computed, ref } from 'vue'
import type { BaseNote } from '@/types'
import { useSlotDropTarget } from '@/composables/pod/useSlotDropTarget'

const props = defineProps<{
  podId: string
  boundNotes: BaseNote[]
  slotClass: string
  menuScrollClass: string
  label: string
  draggedNoteId: () => string | null
  validateDrop: (noteId: string) => boolean
}>()

const emit = defineEmits<{
  'note-dropped': [noteId: string]
}>()

const slotRef = ref<HTMLElement | null>(null)
const showMenu = ref(false)

const noteCount = computed(() => props.boundNotes.length)
const hasNotes = computed(() => noteCount.value > 0)

const { isDropTarget, isInserting } = useSlotDropTarget({
  slotRef,
  draggedNoteId: props.draggedNoteId,
  validateDrop: props.validateDrop,
  onDrop: (noteId: string) => {
    emit('note-dropped', noteId)
  }
})
</script>

<template>
  <div
    ref="slotRef"
    class="pod-slot-base"
    :class="[
      slotClass,
      {
        'drop-target': isDropTarget,
        'pod-slot-has-item': hasNotes,
        'has-notes': hasNotes,
        'inserting': isInserting
      }
    ]"
    @mouseenter="showMenu = true"
    @mouseleave="showMenu = false"
  >
    <span
      class="text-xs font-mono"
      :class="{ 'opacity-50': !hasNotes }"
    >
      <template v-if="hasNotes">({{ noteCount }}) </template>{{ label }}
    </span>

    <div
      v-if="showMenu && hasNotes"
      class="pod-slot-menu-base"
      @wheel.stop.passive
    >
      <div :class="menuScrollClass">
        <div
          v-for="note in boundNotes"
          :key="note.id"
          class="pod-slot-menu-item-base"
        >
          {{ note.name }}
        </div>
      </div>
    </div>
  </div>
</template>
