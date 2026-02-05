<script setup lang="ts">
import {computed, ref} from 'vue'
import type {SubAgentNote} from '@/types'
import {useSubAgentStore} from '@/stores/note'
import {useSlotDropTarget} from '@/composables/pod/useSlotDropTarget'
import {useToast} from '@/composables/useToast'

const props = defineProps<{
  podId: string
  boundNotes: SubAgentNote[]
}>()

const emit = defineEmits<{
  'note-dropped': [noteId: string]
}>()

const subAgentStore = useSubAgentStore()
const {toast} = useToast()

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

    if (subAgentStore.isItemBoundToPod && subAgentStore.isItemBoundToPod(draggedNote.subAgentId, props.podId)) {
      toast({title: '已存在，無法插入', description: '此 SubAgent 已綁定到此 Pod', duration: 3000})
      return false
    }
    return true
  },
  onDrop: (noteId: string) => {
    emit('note-dropped', noteId)
  }
})
</script>

<template>
  <div
    ref="slotRef"
    class="pod-slot-base pod-subagent-slot"
    :class="{
      'drop-target': isDropTarget,
      'has-notes': hasSubAgents,
      inserting: isInserting
    }"
    @mouseenter="showMenu = true"
    @mouseleave="showMenu = false"
  >
    <span
      class="text-xs font-mono"
      :class="{ 'opacity-50': !hasSubAgents }"
    >
      <template v-if="hasSubAgents">({{ subAgentCount }}) </template>SubAgents
    </span>

    <div
      v-if="showMenu && hasSubAgents"
      class="pod-slot-menu-base pod-subagent-menu"
      @wheel.stop.passive
    >
      <div class="pod-subagent-menu-scrollable">
        <div
          v-for="note in boundNotes"
          :key="note.id"
          class="pod-slot-menu-item-base pod-subagent-menu-item"
        >
          {{ note.name }}
        </div>
      </div>
    </div>
  </div>
</template>
