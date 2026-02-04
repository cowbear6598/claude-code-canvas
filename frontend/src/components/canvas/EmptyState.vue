<script setup lang="ts">
import { ref, onMounted } from 'vue'

const centerX = ref(0)
const centerY = ref(0)

onMounted(() => {
  centerX.value = Math.round(window.innerWidth / 2)
  centerY.value = Math.round(window.innerHeight / 2)
})
</script>

<template>
  <div
    class="absolute pointer-events-none"
    :style="{
      left: `${centerX}px`,
      top: `${centerY}px`,
      transform: 'translate(-50%, -50%)'
    }"
  >
    <div class="text-center">
      <div
        class="w-20 h-20 mx-auto mb-4 border-2 border-dashed border-muted-foreground rounded-full flex items-center justify-center"
      >
        <svg
          class="w-8 h-8 text-muted-foreground fill-none"
          stroke="currentColor"
          stroke-width="2"
          viewBox="0 0 24 24"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </div>
      <p class="font-sans text-2xl text-muted-foreground whitespace-nowrap">
        Double-click anywhere to create your first Pod
      </p>
    </div>
  </div>
</template>
