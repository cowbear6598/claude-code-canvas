<script setup lang="ts">
import { computed } from 'vue'
import { useSelectionStore } from '@/stores/pod'

const selectionStore = useSelectionStore()

const boxStyle = computed(() => {
  const box = selectionStore.box
  if (!box) return null

  const left = Math.min(box.startX, box.endX)
  const top = Math.min(box.startY, box.endY)
  const width = Math.abs(box.endX - box.startX)
  const height = Math.abs(box.endY - box.startY)

  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`
  }
})

const shouldShow = computed(() =>
  selectionStore.isSelecting && selectionStore.box
)
</script>

<template>
  <div
    v-if="shouldShow"
    class="selection-box"
    :style="boxStyle"
  />
</template>

<style scoped>
.selection-box {
  position: absolute;
  border: 2px dashed var(--doodle-ink, #333);
  background: oklch(0.7 0.12 170 / 0.15);
  border-radius: 2px;
  pointer-events: none;
  z-index: 1000;
}
</style>
