<template>
  <header
    class="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md"
  >
    <div class="container mx-auto flex h-16 items-center justify-between px-4">
      <!-- Logo -->
      <div class="flex items-center gap-3">
        <Sparkles class="h-6 w-6 text-primary" />
        <h1 class="text-2xl font-bold tracking-tight">Agent Canvas</h1>
      </div>

      <!-- Connection Status -->
      <ConnectionStatus />
    </div>
  </header>
</template>

<script setup lang="ts">
import { Sparkles } from 'lucide-vue-next'
import ConnectionStatus from '@/components/ui/ConnectionStatus.vue'
</script>
