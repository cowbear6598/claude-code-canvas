<script setup lang="ts">
import { computed } from 'vue'
import { useCanvasStore } from '@/stores/canvasStore'
import { useCanvasPan } from '@/composables/useCanvasPan'
import { useCanvasZoom } from '@/composables/useCanvasZoom'

const GRID_SIZE = 20

const store = useCanvasStore()
const { startPan } = useCanvasPan()
const { handleWheel } = useCanvasZoom()

const emit = defineEmits<{
  dblclick: [e: MouseEvent]
}>()

const gridStyle = computed(() => {
  const { offset, zoom } = store.viewport
  const gridSizeScaled = GRID_SIZE * zoom

  return {
    backgroundPosition: `${offset.x % gridSizeScaled}px ${offset.y % gridSizeScaled}px`,
    backgroundSize: `${gridSizeScaled}px ${gridSizeScaled}px`,
  }
})

const handleDoubleClick = (e: MouseEvent) => {
  e.preventDefault()
  emit('dblclick', e)
}
</script>

<template>
  <div
    class="viewport h-full canvas-grid"
    :style="gridStyle"
    @wheel="handleWheel"
    @mousedown="startPan"
    @dblclick="handleDoubleClick"
  >
    <div
      class="canvas-content h-full"
      :style="{
        transform: `translate(${store.viewport.offset.x}px, ${store.viewport.offset.y}px) scale(${store.viewport.zoom})`,
        transformOrigin: '0 0',
      }"
    >
      <slot />
    </div>
  </div>
</template>
