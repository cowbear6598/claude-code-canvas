<template>
  <header
    class="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md"
  >
    <div class="container mx-auto flex h-16 items-center justify-between px-4">
      <!-- Logo -->
      <div class="flex items-center gap-3">
        <Sparkles class="h-6 w-6 text-primary" />
        <h1
          class="text-2xl font-bold tracking-tight"
          style="font-family: var(--font-handwriting)"
        >
          Claude Code Canvas
        </h1>
      </div>

      <!-- Right Section -->
      <div class="flex items-center gap-4">
        <!-- Connection Status -->
        <ConnectionStatus />

        <!-- Canvas Selector -->
        <button
          v-if="canvasStore.activeCanvas"
          data-canvas-toggle
          class="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
          @click="canvasStore.toggleSidebar()"
        >
          <LayoutDashboard class="h-4 w-4" />
          <span>{{ canvasStore.activeCanvas.name }}</span>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { Sparkles, LayoutDashboard } from 'lucide-vue-next'
import ConnectionStatus from '@/components/ui/ConnectionStatus.vue'
import { useCanvasStore } from '@/stores/canvasStore'

const canvasStore = useCanvasStore()
</script>
