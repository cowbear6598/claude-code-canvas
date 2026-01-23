<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { OUTPUT_LINES_PREVIEW_COUNT } from '@/lib/constants'

const props = defineProps<{
  output: string[]
}>()

defineEmits<{
  dblclick: []
}>()

const scrollContainer = ref<HTMLDivElement | null>(null)

// 當 output 變化時，自動滾動到底部
watch(
  () => props.output,
  async () => {
    await nextTick()
    if (scrollContainer.value) {
      scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight
    }
  },
  { deep: true, immediate: true }
)
</script>

<template>
  <div
    ref="scrollContainer"
    class="mini-screen-click mini-screen h-20 p-2 overflow-y-auto cursor-pointer rounded"
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
