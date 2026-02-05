<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SkillNote } from '@/types'
import { useSkillStore } from '@/stores/note'
import { useSlotDropTarget } from '@/composables/pod/useSlotDropTarget'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  podId: string
  boundNotes: SkillNote[]
}>()

const emit = defineEmits<{
  'note-dropped': [noteId: string]
}>()

const skillStore = useSkillStore()
const { toast } = useToast()

const slotRef = ref<HTMLElement | null>(null)
const showMenu = ref(false)

const skillCount = computed(() => props.boundNotes.length)
const hasSkills = computed(() => skillCount.value > 0)

const { isDropTarget, isInserting } = useSlotDropTarget({
  slotRef,
  draggedNoteId: () => skillStore.draggedNoteId,
  validateDrop: (noteId: string) => {
    const draggedNote = skillStore.getNoteById(noteId)
    if (!draggedNote || draggedNote.boundToPodId !== null) return false

    if (skillStore.isItemBoundToPod && skillStore.isItemBoundToPod(draggedNote.skillId, props.podId)) {
      toast({ title: '已存在，無法插入', description: '此 Skill 已綁定到此 Pod', duration: 3000 })
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
    class="pod-slot-base pod-skill-slot"
    :class="{
      'drop-target': isDropTarget,
      'has-notes': hasSkills,
      inserting: isInserting
    }"
    @mouseenter="showMenu = true"
    @mouseleave="showMenu = false"
  >
    <span
      class="text-xs font-mono"
      :class="{ 'opacity-50': !hasSkills }"
    >
      <template v-if="hasSkills">({{ skillCount }}) </template>Skills
    </span>

    <div
      v-if="showMenu && hasSkills"
      class="pod-slot-menu-base pod-skill-menu"
      @wheel.stop.passive
    >
      <div class="pod-skill-menu-scrollable">
        <div
          v-for="note in boundNotes"
          :key="note.id"
          class="pod-slot-menu-item-base pod-skill-menu-item"
        >
          {{ note.name }}
        </div>
      </div>
    </div>
  </div>
</template>
