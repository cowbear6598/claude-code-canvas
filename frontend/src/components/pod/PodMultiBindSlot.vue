<script setup lang="ts">
import { computed, ref } from 'vue'
import type { BaseNote } from '@/types'
import { useSlotDropTarget } from '@/composables/pod/useSlotDropTarget'
import { useToast } from '@/composables/useToast'

interface MultiBindNoteResult {
  id: string
  name: string
  boundToPodId: string | null
}

interface MultiBindStore {
  draggedNoteId: string | null
  getNoteById: (noteId: string) => MultiBindNoteResult | undefined
  isItemBoundToPod?: (itemId: string, podId: string) => boolean
}

const props = defineProps<{
  podId: string
  boundNotes: BaseNote[]
  store: MultiBindStore
  label: string
  duplicateToastTitle: string
  duplicateToastDescription: string
  slotClass: string
  menuScrollableClass: string
  itemIdField: string
}>()

const emit = defineEmits<{
  'note-dropped': [noteId: string]
}>()

const { toast } = useToast()

const slotRef = ref<HTMLElement | null>(null)
const showMenu = ref(false)

const itemCount = computed(() => props.boundNotes.length)
const hasItems = computed(() => itemCount.value > 0)

const { isDropTarget, isInserting } = useSlotDropTarget({
  slotRef,
  draggedNoteId: () => props.store.draggedNoteId,
  validateDrop: (noteId: string) => {
    const draggedNote = props.store.getNoteById(noteId)
    if (!draggedNote || draggedNote.boundToPodId !== null) return false

    const itemId = String(Reflect.get(draggedNote, props.itemIdField) ?? '')
    if (itemId && props.store.isItemBoundToPod && props.store.isItemBoundToPod(itemId, props.podId)) {
      toast({
        title: props.duplicateToastTitle,
        description: props.duplicateToastDescription,
        duration: 3000,
      })
      return false
    }

    return true
  },
  onDrop: (noteId: string) => {
    emit('note-dropped', noteId)
  },
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
        'pod-slot-has-item': hasItems,
        'has-notes': hasItems,
        'inserting': isInserting,
      },
    ]"
    @mouseenter="showMenu = true"
    @mouseleave="showMenu = false"
  >
    <span
      class="text-xs font-mono"
      :class="{ 'opacity-50': !hasItems }"
    >
      <template v-if="hasItems">({{ itemCount }}) </template>{{ label }}
    </span>

    <div
      v-if="showMenu && hasItems"
      class="pod-slot-menu-base"
      @wheel.stop.passive
    >
      <div :class="menuScrollableClass">
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
