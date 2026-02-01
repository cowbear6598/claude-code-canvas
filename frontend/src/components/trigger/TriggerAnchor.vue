<script setup lang="ts">
import { ref, onUnmounted } from 'vue'

const props = defineProps<{
  triggerId: string
}>()

const emit = defineEmits<{
  dragStart: [data: { triggerId: string; anchor: 'right'; screenX: number; screenY: number }]
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
    triggerId: props.triggerId,
    anchor: 'right',
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
      'trigger-anchor',
      { dragging: isDragging }
    ]"
    @mousedown="handleMouseDown"
  />
</template>
