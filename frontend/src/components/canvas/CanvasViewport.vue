<script setup lang="ts">
import { computed } from 'vue'
import { useCanvasStore } from '@/stores/canvasStore'
import { useCanvasPan } from '@/composables/useCanvasPan'
import { useCanvasZoom } from '@/composables/useCanvasZoom'
import { useBoxSelect } from '@/composables/useBoxSelect'
import { GRID_SIZE } from '@/lib/constants'

const store = useCanvasStore()
const { startPan } = useCanvasPan()
const { handleWheel } = useCanvasZoom()
const { startBoxSelect } = useBoxSelect()

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

const handleMouseDown = (e: MouseEvent) => {
  if (e.button === 2) {
    startBoxSelect(e)
    return
  }

  if (e.button === 0) {
    startPan(e)
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
        transform: `translate(${store.viewport.offset.x}px, ${store.viewport.offset.y}px) scale(${store.viewport.zoom})`,
        transformOrigin: '0 0',
      }"
    >
      <slot />
    </div>
  </div>
</template>
