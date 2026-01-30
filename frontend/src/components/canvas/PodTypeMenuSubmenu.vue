<script setup lang="ts" generic="T extends { id: string; name: string }">
import { X } from 'lucide-vue-next'

interface Props<T> {
  items: T[]
  visible: boolean
}

defineProps<Props<T>>()

const emit = defineEmits<{
  'item-select': [item: T]
  'item-delete': [id: string, name: string, event: Event]
}>()

const hoveredItemId = defineModel<string | null>('hoveredItemId')

const handleItemSelect = (item: T): void => {
  emit('item-select', item)
}

const handleItemDelete = (item: T, event: Event): void => {
  emit('item-delete', item.id, item.name, event)
}
</script>

<template>
  <div
    v-if="visible"
    class="pod-menu-submenu"
    @wheel.stop.passive
  >
    <div class="pod-menu-submenu-scrollable">
      <div
        v-for="item in items"
        :key="item.id"
        class="pod-menu-submenu-item-wrapper"
        @mouseenter="hoveredItemId = item.id"
        @mouseleave="hoveredItemId = null"
      >
        <button
          class="pod-menu-submenu-item"
          :title="item.name"
          @click="handleItemSelect(item)"
        >
          {{ item.name }}
        </button>
        <button
          class="pod-menu-submenu-delete-btn"
          @click="handleItemDelete(item, $event)"
        >
          <X :size="14" />
        </button>
      </div>
    </div>
    <slot name="footer" />
  </div>
</template>
