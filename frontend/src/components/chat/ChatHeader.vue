<script setup lang="ts">
import { X, Sparkles } from 'lucide-vue-next'
import type { Pod } from '@/types'

defineProps<{
  pod: Pod
}>()

defineEmits<{
  close: []
}>()
</script>

<template>
  <div class="flex items-center justify-between p-4 border-b-2 border-doodle-ink">
    <div class="flex items-center gap-3">
      <div
        class="w-10 h-10 rounded-full bg-doodle-green border-2 border-doodle-ink flex items-center justify-center"
      >
        <Sparkles
          :size="20"
          class="text-card"
        />
      </div>
      <div>
        <h2 class="font-sans text-2xl text-foreground">
          {{ pod.name }}
        </h2>
        <p class="text-sm font-mono text-muted-foreground">
          {{ pod.type }}
        </p>
      </div>
    </div>
    <button
      class="w-10 h-10 rounded-full border-2 border-doodle-ink flex items-center justify-center hover:bg-secondary transition-colors"
      @click="$emit('close')"
    >
      <X :size="20" />
    </button>
  </div>
</template>
