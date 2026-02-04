<script setup lang="ts" generic="T extends { id: string; name: string }">
import { ref, computed, watch, nextTick } from 'vue'
import { X, Pencil } from 'lucide-vue-next'

interface Props<T> {
  items: T[]
  visible: boolean
  editable?: boolean
}

const props = withDefaults(defineProps<Props<T>>(), {
  editable: true
})

const emit = defineEmits<{
  'item-select': [item: T]
  'item-edit': [id: string, name: string, event: Event]
  'item-delete': [id: string, name: string, event: Event]
}>()

const hoveredItemId = defineModel<string | null>('hoveredItemId')

const searchInputRef = ref<HTMLInputElement | null>(null)
const searchQuery = ref('')

const filteredItems = computed(() => {
  if (searchQuery.value === '') {
    return props.items
  }
  return props.items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

watch(() => props.visible, (newVisible) => {
  if (newVisible) {
    nextTick(() => searchInputRef.value?.focus())
  } else {
    searchQuery.value = ''
  }
})

const handleItemSelect = (item: T): void => {
  emit('item-select', item)
}

const handleItemEdit = (item: T, event: Event): void => {
  emit('item-edit', item.id, item.name, event)
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
    <input
      ref="searchInputRef"
      v-model="searchQuery"
      class="pod-menu-submenu-search"
      type="text"
    >
    <div class="pod-menu-submenu-scrollable">
      <div
        v-for="item in filteredItems"
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
          <span class="truncate block">{{ item.name }}</span>
        </button>
        <button
          v-if="editable"
          class="pod-menu-submenu-edit-btn"
          @click="handleItemEdit(item, $event)"
        >
          <Pencil :size="14" />
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
