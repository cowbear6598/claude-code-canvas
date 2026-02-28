<script setup lang="ts">
import {computed, ref} from 'vue'
import type {McpServerNote} from '@/types'
import {useMcpServerStore} from '@/stores/note'
import {useSlotDropTarget} from '@/composables/pod/useSlotDropTarget'
import {useToast} from '@/composables/useToast'

const props = defineProps<{
  podId: string
  boundNotes: McpServerNote[]
}>()

const emit = defineEmits<{
  'note-dropped': [noteId: string]
}>()

const mcpServerStore = useMcpServerStore()
const {toast} = useToast()

const slotRef = ref<HTMLElement | null>(null)
const showMenu = ref(false)

const mcpServerCount = computed(() => props.boundNotes.length)
const hasMcpServers = computed(() => mcpServerCount.value > 0)

const {isDropTarget, isInserting} = useSlotDropTarget({
  slotRef,
  draggedNoteId: () => mcpServerStore.draggedNoteId,
  validateDrop: (noteId: string) => {
    const draggedNote = mcpServerStore.getNoteById(noteId)
    if (!draggedNote || draggedNote.boundToPodId !== null) return false

    if (mcpServerStore.isItemBoundToPod && mcpServerStore.isItemBoundToPod(draggedNote.mcpServerId, props.podId)) {
      toast({title: '已存在，無法插入', description: '此 MCP Server 已綁定到此 Pod', duration: 3000})
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
    class="pod-slot-base pod-mcp-server-slot"
    :class="{
      'drop-target': isDropTarget,
      'pod-slot-has-item': hasMcpServers,
      'has-notes': hasMcpServers,
      inserting: isInserting
    }"
    @mouseenter="showMenu = true"
    @mouseleave="showMenu = false"
  >
    <span
      class="text-xs font-mono"
      :class="{ 'opacity-50': !hasMcpServers }"
    >
      <template v-if="hasMcpServers">({{ mcpServerCount }}) </template>MCPs
    </span>

    <div
      v-if="showMenu && hasMcpServers"
      class="pod-slot-menu-base"
      @wheel.stop.passive
    >
      <div class="pod-mcp-server-menu-scrollable">
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
