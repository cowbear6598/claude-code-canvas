<script setup lang="ts">
import { ref } from 'vue'
import type { CommandNote } from '@/types'
import { useCommandStore } from '@/stores/note'
import { useViewportStore } from '@/stores/pod'
import { useSlotDropTarget } from '@/composables/pod/useSlotDropTarget'
import { useSlotEject } from '@/composables/pod/useSlotEject'

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

const { isDropTarget, isInserting } = useSlotDropTarget({
  slotRef,
  draggedNoteId: () => commandStore.draggedNoteId,
  validateDrop: (noteId: string) => {
    const draggedNote = commandStore.getNoteById(noteId)
    return draggedNote !== undefined && !draggedNote.boundToPodId
  },
  onDrop: (noteId: string) => {
    emit('note-dropped', noteId)
  }
})

const { isEjecting, handleSlotClick: ejectSlotClick } = useSlotEject({
  slotRef,
  podRotation: () => props.podRotation || 0,
  getNoteById: (id: string) => commandStore.getNoteById(id),
  setNoteAnimating: (noteId: string, animating: boolean) => commandStore.setNoteAnimating(noteId, animating),
  unbindFromPod: (podId: string, notify: boolean) => commandStore.unbindFromPod(podId, notify),
  updateNotePosition: (noteId: string, x: number, y: number) => commandStore.updateNotePosition(noteId, x, y),
  getViewportZoom: () => viewportStore.zoom,
  getViewportOffset: () => viewportStore.offset
})

const handleSlotClick = async (e: MouseEvent): Promise<void> => {
  if (!props.boundNote) return
  await ejectSlotClick(e, props.boundNote.id, props.podId, () => emit('note-removed'))
}
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
