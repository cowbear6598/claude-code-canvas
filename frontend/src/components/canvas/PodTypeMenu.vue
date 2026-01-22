<script setup lang="ts">
import type { Position, PodTypeConfig } from '@/types'
import { podTypes } from '@/data/podTypes'

defineProps<{
  position: Position
}>()

const emit = defineEmits<{
  select: [config: PodTypeConfig]
  close: []
}>()

const handleSelect = (config: PodTypeConfig) => {
  emit('select', config)
}

const handleClose = () => {
  emit('close')
}
</script>

<template>
  <div>
    <!-- 背景遮罩 -->
    <div class="fixed inset-0 z-40" @click="handleClose" />

    <!-- 選單內容 -->
    <div
      class="fixed z-50 bg-card border-2 border-doodle-ink rounded-lg p-2 min-w-48 origin-top-left"
      :style="{
        left: `${position.x}px`,
        top: `${position.y}px`,
        boxShadow: '3px 3px 0 var(--doodle-ink)',
        transform: 'scale(0.8)',
      }"
    >
      <p class="font-sans text-xl text-foreground px-2 pb-2 border-b border-border mb-2">
        Create New Pod
      </p>
      <button
        v-for="type in podTypes"
        :key="type.type"
        class="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-secondary transition-colors text-left"
        @click="handleSelect(type)"
      >
        <span
          class="w-8 h-8 rounded-full flex items-center justify-center border border-doodle-ink"
          :style="{ backgroundColor: `var(--doodle-${type.color})` }"
        >
          <component :is="type.icon" :size="16" class="text-card" />
        </span>
        <span class="font-mono text-sm text-foreground">{{ type.type }}</span>
      </button>
    </div>
  </div>
</template>
