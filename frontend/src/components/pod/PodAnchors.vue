<script setup lang="ts">
import type { AnchorPosition } from '@/types/connection'
import PodAnchor from '@/components/pod/PodAnchor.vue'

const props = defineProps<{
  podId: string
}>()

const emit = defineEmits<{
  'drag-start': [data: { podId: string; anchor: AnchorPosition; screenX: number; screenY: number }]
  'drag-move': [data: { screenX: number; screenY: number }]
  'drag-end': []
}>()

const handleDragStart = (data: { podId: string; anchor: AnchorPosition; screenX: number; screenY: number }) => {
  emit('drag-start', data)
}

const handleDragMove = (data: { screenX: number; screenY: number }) => {
  emit('drag-move', data)
}

const handleDragEnd = () => {
  emit('drag-end')
}
</script>

<template>
  <PodAnchor
    position="top"
    :pod-id="podId"
    @drag-start="handleDragStart"
    @drag-move="handleDragMove"
    @drag-end="handleDragEnd"
  />
  <PodAnchor
    position="bottom"
    :pod-id="podId"
    @drag-start="handleDragStart"
    @drag-move="handleDragMove"
    @drag-end="handleDragEnd"
  />
  <PodAnchor
    position="left"
    :pod-id="podId"
    @drag-start="handleDragStart"
    @drag-move="handleDragMove"
    @drag-end="handleDragEnd"
  />
  <PodAnchor
    position="right"
    :pod-id="podId"
    @drag-start="handleDragStart"
    @drag-move="handleDragMove"
    @drag-end="handleDragEnd"
  />
</template>
