<script setup lang="ts">
// Canvas 空狀態提示組件
</script>

<template>
  <div class="absolute inset-0 flex items-center justify-center pointer-events-none pt-20">
    <div class="text-center">
      <div
        class="w-20 h-20 mx-auto mb-4 border-2 border-dashed border-muted-foreground rounded-full flex items-center justify-center"
      >
        <span class="text-4xl text-muted-foreground">+</span>
      </div>
      <p class="font-sans text-2xl text-muted-foreground">
        Double-click anywhere to create your first Pod
      </p>
    </div>
  </div>
</template>
