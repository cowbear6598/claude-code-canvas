<script setup lang="ts">
// 打字指示器組件 - 三個跳動的圓點
</script>

<template>
  <div class="flex gap-1">
    <span
      class="w-2 h-2 bg-doodle-ink rounded-full animate-bounce"
      style="animation-delay: 0ms"
    />
    <span
      class="w-2 h-2 bg-doodle-ink rounded-full animate-bounce"
      style="animation-delay: 150ms"
    />
    <span
      class="w-2 h-2 bg-doodle-ink rounded-full animate-bounce"
      style="animation-delay: 300ms"
    />
  </div>
</template>
