<script setup lang="ts">
import { ref, watch } from 'vue'
import type { PodTypeName, PodColor } from '@/types'
import { COLOR_MAP, MAX_POD_NAME_LENGTH } from '@/lib/constants'

const props = defineProps<{
  name: string
  type: PodTypeName
  color: PodColor
  isEditing: boolean
}>()

const emit = defineEmits<{
  'update:name': [name: string]
  save: []
}>()

const editName = ref(props.name)

// 當 name prop 改變時更新 editName
watch(() => props.name, (newName) => {
  editName.value = newName
})

const handleSave = () => {
  const trimmedName = editName.value.trim()
  if (trimmedName && trimmedName.length <= MAX_POD_NAME_LENGTH) {
    emit('update:name', trimmedName)
  } else {
    editName.value = props.name
  }
  emit('save')
}
</script>

<template>
  <div>
    <!-- 標題行 -->
    <div class="flex items-center gap-2 mb-2">
      <div
        :class="['w-3 h-3 rounded-full border border-doodle-ink/50', COLOR_MAP[color]]"
      />
      <input
        v-if="isEditing"
        v-model="editName"
        type="text"
        :maxlength="MAX_POD_NAME_LENGTH"
        class="flex-1 bg-transparent border-b-2 border-doodle-ink/50 outline-none font-sans text-lg"
        @blur="handleSave"
        @keydown.enter="handleSave"
      />
      <h3 v-else class="flex-1 font-sans text-xl text-foreground truncate">
        {{ name }}
      </h3>
    </div>
    <!-- 類型文字 -->
    <p class="text-xs text-muted-foreground font-mono mb-2">{{ type }}</p>
  </div>
</template>
