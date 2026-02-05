<script setup lang="ts">
import { Folder, FolderOpen, ChevronRight, ChevronDown, X } from 'lucide-vue-next'

interface Props {
  group: { id: string; name: string; type: string }
  isExpanded: boolean
  isDragOver: boolean
  canDelete: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  click: []
  delete: [event: Event]
  dragover: [event: DragEvent]
  dragleave: [event: DragEvent]
  drop: [event: DragEvent]
}>()

const handleClick = (): void => {
  emit('click')
}

const handleDelete = (event: Event): void => {
  event.stopPropagation()
  emit('delete', event)
}

const handleDragOver = (event: DragEvent): void => {
  event.preventDefault()
  emit('dragover', event)
}

const handleDragLeave = (event: DragEvent): void => {
  emit('dragleave', event)
}

const handleDrop = (event: DragEvent): void => {
  event.preventDefault()
  emit('drop', event)
}
</script>

<template>
  <div
    class="pod-menu-submenu-item-wrapper"
    :class="{ 'pod-menu-submenu-group--drag-over': isDragOver }"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <button
      class="pod-menu-submenu-group pod-menu-submenu-item flex items-center gap-2"
      :title="group.name"
      @click="handleClick"
    >
      <FolderOpen
        v-if="isExpanded"
        :size="14"
        class="flex-shrink-0"
      />
      <Folder
        v-else
        :size="14"
        class="flex-shrink-0"
      />
      <span class="truncate block flex-1">{{ group.name }}</span>
      <ChevronDown
        v-if="isExpanded"
        :size="14"
        class="pod-menu-submenu-group-chevron flex-shrink-0"
      />
      <ChevronRight
        v-else
        :size="14"
        class="pod-menu-submenu-group-chevron flex-shrink-0"
      />
    </button>
    <button
      v-if="canDelete"
      class="pod-menu-submenu-delete-btn"
      :class="{ 'pod-menu-submenu-group-delete-disabled': !canDelete }"
      :disabled="!canDelete"
      @click.stop="handleDelete"
    >
      <X :size="14" />
    </button>
  </div>
</template>
