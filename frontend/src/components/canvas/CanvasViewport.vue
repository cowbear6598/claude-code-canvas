<script setup lang="ts">
import { computed } from 'vue'
import { useViewportStore } from '@/stores/pod'
import { useCanvasPan, useCanvasZoom, useBoxSelect } from '@/composables/canvas'
import { GRID_SIZE } from '@/lib/constants'

const viewportStore = useViewportStore()
const { startPan } = useCanvasPan()
const { handleWheel } = useCanvasZoom()
const { startBoxSelect } = useBoxSelect()

const emit = defineEmits<{
  dblclick: [e: MouseEvent]
}>()

const gridStyle = computed(() => {
  const { offset, zoom } = viewportStore
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

const handleMouseDown = (e: MouseEvent) => {
  if (e.button === 2) {
    startPan(e)
    return
  }

  if (e.button === 0) {
    startBoxSelect(e)
  }
}
</script>

<template>
  <div
    class="viewport h-full canvas-grid"
    :style="gridStyle"
    @wheel="handleWheel"
    @mousedown="handleMouseDown"
    @dblclick="handleDoubleClick"
    @contextmenu.prevent
  >
    <div
      class="canvas-content h-full"
      :style="{
        transform: `translate(${viewportStore.offset.x}px, ${viewportStore.offset.y}px) scale(${viewportStore.zoom})`,
        transformOrigin: '0 0',
      }"
    >
      <slot />
    </div>
  </div>
</template>
