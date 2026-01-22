<script setup lang="ts">
import { OUTPUT_LINES_PREVIEW_COUNT } from '@/lib/constants'

defineProps<{
  output: string[]
}>()

defineEmits<{
  click: []
}>()
</script>

<template>
  <div
    class="mini-screen-click mini-screen h-20 p-2 overflow-hidden cursor-pointer rounded"
    @click="$emit('click')"
  >
    <div class="text-xs leading-relaxed">
      <div
        v-for="(line, i) in output.slice(-OUTPUT_LINES_PREVIEW_COUNT)"
        :key="i"
        class="truncate opacity-80"
      >
        {{ line }}
      </div>
      <span class="cursor-blink">_</span>
    </div>
  </div>
</template>
