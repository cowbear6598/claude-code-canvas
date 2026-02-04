<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import type { AnchorPosition } from '@/types/connection'

const props = defineProps<{
  position: AnchorPosition
  podId: string
}>()

const emit = defineEmits<{
  dragStart: [data: { podId: string; anchor: AnchorPosition; screenX: number; screenY: number }]
  dragMove: [data: { screenX: number; screenY: number }]
  dragEnd: []
}>()

const isDragging = ref(false)
let currentMouseMoveHandler: ((e: MouseEvent) => void) | null = null
let currentMouseUpHandler: (() => void) | null = null

const cleanupEventListeners = (): void => {
  if (currentMouseMoveHandler) {
    document.removeEventListener('mousemove', currentMouseMoveHandler)
    currentMouseMoveHandler = null
  }
  if (currentMouseUpHandler) {
    document.removeEventListener('mouseup', currentMouseUpHandler)
    currentMouseUpHandler = null
  }
}

onUnmounted(() => {
  cleanupEventListeners()
})

const handleMouseDown = (e: MouseEvent): void => {
  e.stopPropagation()
  e.preventDefault()

  isDragging.value = true
  cleanupEventListeners()

  emit('dragStart', {
    podId: props.podId,
    anchor: props.position,
    screenX: e.clientX,
    screenY: e.clientY,
  })

  const handleMouseMove = (moveEvent: MouseEvent): void => {
    emit('dragMove', {
      screenX: moveEvent.clientX,
      screenY: moveEvent.clientY,
    })
  }

  const handleMouseUp = (): void => {
    isDragging.value = false
    emit('dragEnd')
    cleanupEventListeners()
  }

  currentMouseMoveHandler = handleMouseMove
  currentMouseUpHandler = handleMouseUp

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}
</script>

<template>
  <div
    :class="[
      'pod-anchor',
      `anchor-${position}`,
      { dragging: isDragging }
    ]"
    @mousedown="handleMouseDown"
  />
</template>
