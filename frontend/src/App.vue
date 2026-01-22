<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useCanvasStore } from '@/stores/canvasStore'
import { useChatStore } from '@/stores/chatStore'
import AppHeader from '@/components/layout/AppHeader.vue'
import CanvasContainer from '@/components/canvas/CanvasContainer.vue'
import ChatModal from '@/components/chat/ChatModal.vue'

const store = useCanvasStore()
const chatStore = useChatStore()

const selectedPod = computed(() => store.selectedPod)

const handleCloseChat = () => {
  store.selectPod(null)
}

// Initialize WebSocket connection on mount
onMounted(async () => {
  console.log('[App] Initializing WebSocket connection')
  chatStore.initWebSocket()

  // Wait a moment for connection to establish, then load existing pods
  // This is optional - you can also load pods on-demand
  setTimeout(async () => {
    try {
      await store.loadPodsFromBackend()
      console.log('[App] Loaded existing pods from backend')
    } catch (error) {
      console.warn('[App] Failed to load pods from backend:', error)
      // Don't throw - app should still work with local pods
    }
  }, 1000)
})

// Optionally disconnect on unmount
onUnmounted(() => {
  console.log('[App] Disconnecting WebSocket')
  chatStore.disconnectWebSocket()
})
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
