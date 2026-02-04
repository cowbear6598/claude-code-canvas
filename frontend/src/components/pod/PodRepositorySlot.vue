<script setup lang="ts">
import { ref } from 'vue'
import type { RepositoryNote } from '@/types'
import { useCanvasContext } from '@/composables/canvas/useCanvasContext'
import { useSlotDropTarget } from '@/composables/pod/useSlotDropTarget'
import { useSlotEject } from '@/composables/pod/useSlotEject'

const props = defineProps<{
  podId: string
  boundNote: RepositoryNote | undefined
  podRotation?: number
}>()

const emit = defineEmits<{
  'note-dropped': [noteId: string]
  'note-removed': []
}>()

const { repositoryStore, viewportStore } = useCanvasContext()
const slotRef = ref<HTMLElement | null>(null)

const { isDropTarget, isInserting } = useSlotDropTarget({
  slotRef,
  draggedNoteId: () => repositoryStore.draggedNoteId,
  validateDrop: (noteId: string) => {
    const draggedNote = repositoryStore.getNoteById(noteId)
    return draggedNote !== undefined && !draggedNote.boundToPodId
  },
  onDrop: (noteId: string) => {
    emit('note-dropped', noteId)
  }
})

const { isEjecting, handleSlotClick: ejectSlotClick } = useSlotEject({
  slotRef,
  podRotation: () => props.podRotation || 0,
  getNoteById: (id: string) => repositoryStore.getNoteById(id),
  setNoteAnimating: (noteId: string, animating: boolean) => repositoryStore.setNoteAnimating(noteId, animating),
  unbindFromPod: (podId: string, notify: boolean, targetPosition?: {x: number, y: number}) => repositoryStore.unbindFromPod(podId, notify, targetPosition),
  updateNotePosition: (noteId: string, x: number, y: number) => repositoryStore.updateNotePosition(noteId, x, y),
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
