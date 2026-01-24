<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  visible: boolean
  isHighlighted: boolean
}>()

const TRASH_ZONE_RADIUS = 60

const trashZoneRef = ref<HTMLDivElement | null>(null)

const isPointInZone = (x: number, y: number): boolean => {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return false
  }

  if (!trashZoneRef.value) return false

  const rect = trashZoneRef.value.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2

  const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2)
  return distance <= TRASH_ZONE_RADIUS
}

defineExpose({
  isPointInZone,
})
</script>

<template>
  <div
    ref="trashZoneRef"
    class="trash-zone"
    :class="{ visible }"
  >
    <div
      class="trash-zone-inner"
      :class="{ highlighted: isHighlighted }"
    >
      <svg
        class="trash-zone-icon"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
        />
      </svg>
    </div>
  </div>
</template>
