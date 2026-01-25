<script setup lang="ts">
import { OUTPUT_LINES_PREVIEW_COUNT } from '@/lib/constants'

defineProps<{
  output: string[]
}>()

defineEmits<{
  dblclick: []
}>()
</script>

<template>
  <div
    class="mini-screen-click mini-screen h-[100px] p-2 mb-2 overflow-hidden cursor-pointer rounded flex flex-col justify-end"
    @dblclick="$emit('dblclick')"
  >
    <div class="text-xs leading-relaxed">
      <div
        v-for="(line, i) in output.slice(-OUTPUT_LINES_PREVIEW_COUNT)"
        :key="`${output.length}-${i}-${line}`"
        class="truncate opacity-80"
      >
        {{ line }}
      </div>
      <span class="cursor-blink">_</span>
    </div>
  </div>
</template>
