<script setup lang="ts">
import { tools } from '@/data/tools'
</script>

<template>
  <div class="tool-panel w-48 p-3 flex flex-col gap-2 h-fit">
    <h3 class="font-sans text-lg text-doodle-ink mb-2 text-center">Tools</h3>
    <div class="grid grid-cols-2 gap-2">
      <button v-for="tool in tools" :key="tool.label" class="tool-item p-3 flex flex-col items-center gap-1">
        <div
          :class="[
            'w-8 h-8 rounded-full border border-doodle-ink flex items-center justify-center',
            tool.color,
          ]"
        >
          <component :is="tool.icon" :size="16" class="text-card" />
        </div>
        <span class="text-xs font-mono text-foreground">{{ tool.label }}</span>
      </button>
    </div>
  </div>
</template>
