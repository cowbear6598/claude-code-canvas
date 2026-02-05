<script setup lang="ts">
import { ref } from 'vue'
import { FileText, Pencil, X } from 'lucide-vue-next'

interface Props {
  item: { id: string; name: string }
  isIndented?: boolean
  editable?: boolean
}

withDefaults(defineProps<Props>(), {
  isIndented: false,
  editable: true
})

const emit = defineEmits<{
  select: []
  edit: [event: Event]
  delete: [event: Event]
  dragstart: [event: DragEvent]
  dragend: [event: DragEvent]
}>()

const isDragging = ref(false)

const handleSelect = (): void => {
  emit('select')
}

const handleEdit = (event: Event): void => {
  event.stopPropagation()
  emit('edit', event)
}

const handleDelete = (event: Event): void => {
  event.stopPropagation()
  emit('delete', event)
}

const handleDragStart = (event: DragEvent): void => {
  isDragging.value = true
  emit('dragstart', event)
}

const handleDragEnd = (event: DragEvent): void => {
  isDragging.value = false
  emit('dragend', event)
}
</script>

<template>
  <div
    class="pod-menu-submenu-item-wrapper"
    :class="{ 'pod-menu-submenu-item--dragging': isDragging }"
  >
    <button
      class="pod-menu-submenu-item flex items-center gap-2"
      :class="{ 'pod-menu-submenu-item--indented': isIndented }"
      :title="item.name"
      draggable="true"
      @click="handleSelect"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
    >
      <FileText
        :size="14"
        class="flex-shrink-0"
      />
      <span class="truncate block">{{ item.name }}</span>
    </button>
    <button
      v-if="editable"
      class="pod-menu-submenu-edit-btn"
      @click="handleEdit"
    >
      <Pencil :size="14" />
    </button>
    <button
      class="pod-menu-submenu-delete-btn"
      @click="handleDelete"
    >
      <X :size="14" />
    </button>
  </div>
</template>
