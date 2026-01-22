<script setup lang="ts">
import { computed } from 'vue'
import { useCanvasStore } from '@/stores/canvasStore'
import AppHeader from '@/components/layout/AppHeader.vue'
import CanvasContainer from '@/components/canvas/CanvasContainer.vue'
import ChatModal from '@/components/chat/ChatModal.vue'

const store = useCanvasStore()

const selectedPod = computed(() => store.selectedPod)

const handleCloseChat = () => {
  store.selectPod(null)
}
</script>

<template>
  <div class="h-screen bg-background overflow-hidden flex flex-col">
    <!-- Header -->
    <AppHeader />

    <!-- Canvas -->
    <main class="flex-1 relative overflow-hidden">
      <CanvasContainer />
    </main>

    <!-- Chat Modal -->
    <ChatModal
      v-if="selectedPod"
      :pod="selectedPod"
      @close="handleCloseChat"
      @update-pod="store.updatePod"
    />
  </div>
</template>
