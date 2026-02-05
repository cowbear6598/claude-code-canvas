<script setup lang="ts">
import { ref } from 'vue'
import type { OutputStyleNote } from '@/types'
import { useCanvasContext } from '@/composables/canvas/useCanvasContext'
import { useSlotDropTarget } from '@/composables/pod/useSlotDropTarget'
import { useSlotEject } from '@/composables/pod/useSlotEject'

const props = defineProps<{
  podId: string
  boundNote: OutputStyleNote | undefined
  podRotation?: number
}>()

const emit = defineEmits<{
  'note-dropped': [noteId: string]
  'note-removed': []
}>()

const { outputStyleStore, viewportStore } = useCanvasContext()
const slotRef = ref<HTMLElement | null>(null)

const { isDropTarget, isInserting } = useSlotDropTarget({
  slotRef,
  draggedNoteId: () => outputStyleStore.draggedNoteId,
  validateDrop: (noteId: string) => {
    const draggedNote = outputStyleStore.getNoteById(noteId)
    return draggedNote !== undefined && !draggedNote.boundToPodId
  },
  onDrop: (noteId: string) => {
    emit('note-dropped', noteId)
  }
})

const { isEjecting, handleSlotClick: ejectSlotClick } = useSlotEject({
  slotRef,
  podRotation: () => props.podRotation || 0,
  getNoteById: (id: string) => outputStyleStore.getNoteById(id),
  setNoteAnimating: (noteId: string, animating: boolean) => outputStyleStore.setNoteAnimating(noteId, animating),
  unbindFromPod: (podId: string, notify: boolean, targetPosition?: {x: number, y: number}) => outputStyleStore.unbindFromPod(podId, notify, targetPosition),
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
    class="pod-slot-base pod-output-style-slot"
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
      <span class="text-xs font-mono opacity-50">Style</span>
    </template>
  </div>
</template>
