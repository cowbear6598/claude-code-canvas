<script setup lang="ts" generic="T extends { id: string; name: string; groupId?: string | null }">
import { ref, computed, watch, nextTick } from 'vue'
import type { Group } from '@/types'
import SubmenuGroupItem from './SubmenuGroupItem.vue'
import SubmenuFileItem from './SubmenuFileItem.vue'
import { useSubmenuDragDrop } from '@/composables/useSubmenuDragDrop'

interface Props<T> {
  items: T[]
  visible: boolean
  editable?: boolean
  groups?: Group[]
  expandedGroupIds?: Set<string>
  enableGrouping?: boolean
}

const props = withDefaults(defineProps<Props<T>>(), {
  editable: true,
  groups: () => [],
  expandedGroupIds: () => new Set<string>(),
  enableGrouping: true
})

const emit = defineEmits<{
  'item-select': [item: T]
  'item-edit': [id: string, name: string, event: Event]
  'item-delete': [id: string, name: string, event: Event]
  'toggle-group': [groupId: string]
  'group-delete': [groupId: string, name: string, event: Event]
  'item-drop-to-group': [itemId: string, groupId: string | null]
}>()

const hoveredItemId = defineModel<string | null>('hoveredItemId')

const searchInputRef = ref<HTMLInputElement | null>(null)
const searchQuery = ref('')

const {
  draggedItemId,
  dragOverGroupId,
  isDraggingOverRoot,
  handleDragStart,
  handleDragEnd,
  handleGroupDragOver,
  handleGroupDragLeave,
  handleGroupDrop,
  handleRootDragOver,
  handleRootDragLeave,
  handleRootDrop
} = useSubmenuDragDrop((itemId: string, groupId: string | null) => {
  emit('item-drop-to-group', itemId, groupId)
})

const filteredItems = computed(() => {
  if (searchQuery.value === '') {
    return props.items
  }
  return props.items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

const sortedGroups = computed(() => {
  const sorted = [...props.groups].sort((a, b) => a.name.localeCompare(b.name))

  // 如果沒有搜尋，顯示所有 groups
  if (searchQuery.value === '') {
    return sorted
  }

  // 有搜尋時，只顯示包含符合項目的 groups
  return sorted.filter(group => {
    const groupItems = props.items.filter(item => item.groupId === group.id)
    return groupItems.some(item =>
      item.name.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  })
})

const getRootItems = computed(() => {
  const filtered = filteredItems.value.filter(item => !item.groupId)
  return filtered.sort((a, b) => a.name.localeCompare(b.name))
})

const getItemsByGroupId = (groupId: string): T[] => {
  const filtered = filteredItems.value.filter(item => item.groupId === groupId)
  return filtered.sort((a, b) => a.name.localeCompare(b.name))
}

const isGroupExpanded = (groupId: string): boolean => {
  return props.expandedGroupIds.has(groupId)
}

const canDeleteGroup = (groupId: string): boolean => {
  return !props.items.some(item => item.groupId === groupId)
}

watch(() => props.visible, (newVisible) => {
  if (newVisible) {
    nextTick(() => searchInputRef.value?.focus())
  } else {
    searchQuery.value = ''
  }
})

watch(searchQuery, (query) => {
  if (query && props.enableGrouping) {
    const matchingItemIds = filteredItems.value.map(item => item.id)
    const groupsToExpand = new Set<string>()

    for (const item of filteredItems.value) {
      if (item.groupId && matchingItemIds.includes(item.id)) {
        groupsToExpand.add(item.groupId)
      }
    }

    groupsToExpand.forEach(groupId => {
      if (!props.expandedGroupIds.has(groupId)) {
        emit('toggle-group', groupId)
      }
    })
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

const handleToggleGroup = (groupId: string): void => {
  emit('toggle-group', groupId)
}

const handleGroupDelete = (groupId: string, name: string, event: Event): void => {
  event.stopPropagation()
  emit('group-delete', groupId, name, event)
}

const onItemDragStart = (item: T, event: DragEvent): void => {
  handleDragStart(item.id, event)
}

const onItemDragEnd = (): void => {
  handleDragEnd()
}

const onGroupDragOver = (groupId: string, event: DragEvent): void => {
  handleGroupDragOver(groupId, event)
}

const onGroupDragLeave = (): void => {
  handleGroupDragLeave()
}

const onGroupDrop = (groupId: string, event: DragEvent): void => {
  handleGroupDrop(groupId, event)
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
      <!-- 根目錄拖放區域 -->
      <div
        v-if="enableGrouping && draggedItemId"
        class="pod-menu-submenu-root-dropzone"
        :class="{ 'pod-menu-submenu-root-dropzone--drag-over': isDraggingOverRoot }"
        @dragover="handleRootDragOver"
        @dragleave="handleRootDragLeave"
        @drop="handleRootDrop"
      />

      <!-- 群組列表 -->
      <template v-if="enableGrouping">
        <div
          v-for="group in sortedGroups"
          :key="group.id"
        >
          <SubmenuGroupItem
            :group="group"
            :is-expanded="isGroupExpanded(group.id)"
            :is-drag-over="dragOverGroupId === group.id"
            :can-delete="canDeleteGroup(group.id)"
            @click="handleToggleGroup(group.id)"
            @delete="handleGroupDelete(group.id, group.name, $event)"
            @dragover="onGroupDragOver(group.id, $event)"
            @dragleave="onGroupDragLeave"
            @drop="onGroupDrop(group.id, $event)"
          />

          <!-- 群組內的項目 -->
          <template v-if="isGroupExpanded(group.id)">
            <SubmenuFileItem
              v-for="item in getItemsByGroupId(group.id)"
              :key="item.id"
              :item="item"
              :is-indented="true"
              :editable="editable"
              @select="handleItemSelect(item)"
              @edit="handleItemEdit(item, $event)"
              @delete="handleItemDelete(item, $event)"
              @dragstart="onItemDragStart(item, $event)"
              @dragend="onItemDragEnd"
              @mouseenter="hoveredItemId = item.id"
              @mouseleave="hoveredItemId = null"
            />
          </template>
        </div>
      </template>

      <!-- 根目錄項目 -->
      <SubmenuFileItem
        v-for="item in getRootItems"
        :key="item.id"
        :item="item"
        :is-indented="false"
        :editable="editable"
        @select="handleItemSelect(item)"
        @edit="handleItemEdit(item, $event)"
        @delete="handleItemDelete(item, $event)"
        @dragstart="onItemDragStart(item, $event)"
        @dragend="onItemDragEnd"
        @mouseenter="hoveredItemId = item.id"
        @mouseleave="hoveredItemId = null"
      />
    </div>
    <slot name="footer" />
  </div>
</template>
