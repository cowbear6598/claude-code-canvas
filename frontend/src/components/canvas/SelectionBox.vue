<script setup lang="ts">
import { computed } from 'vue'
import { useCanvasStore } from '@/stores/canvasStore'

const canvasStore = useCanvasStore()

const boxStyle = computed(() => {
  const box = canvasStore.selection.box
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
  canvasStore.selection.isSelecting && canvasStore.selection.box
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
