<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useCanvasStore } from '@/stores/canvasStore'
import { useChatStore } from '@/stores/chatStore'
import { useOutputStyleStore } from '@/stores/outputStyleStore'
import AppHeader from '@/components/layout/AppHeader.vue'
import CanvasContainer from '@/components/canvas/CanvasContainer.vue'
import ChatModal from '@/components/chat/ChatModal.vue'
import {
  CONTENT_PREVIEW_LENGTH,
  RESPONSE_PREVIEW_LENGTH,
  OUTPUT_LINES_PREVIEW_COUNT,
} from '@/lib/constants'

const canvasStore = useCanvasStore()
const chatStore = useChatStore()
const outputStyleStore = useOutputStyleStore()

const selectedPod = computed(() => canvasStore.selectedPod)

/**
 * Connection establishment delay (ms)
 */
const CONNECTION_DELAY_MS = 1000

/**
 * Truncate content with ellipsis if needed
 */
const truncateContent = (content: string, maxLength: number): string => {
  return content.length > maxLength
    ? `${content.slice(0, maxLength)}...`
    : content
}

/**
 * Sync chat history to pod output
 */
const syncHistoryToPodOutput = (): void => {
  console.log('[App] Syncing chat history to pod output')

  for (const pod of canvasStore.pods) {
    const messages = chatStore.getMessages(pod.id)

    if (messages.length === 0) continue

    // Get the most recent messages (last N messages)
    const recentMessages = messages.slice(-OUTPUT_LINES_PREVIEW_COUNT * 2)

    // Convert messages to output format (same as ChatModal.vue)
    const output: string[] = []
    for (const message of recentMessages) {
      if (message.role === 'user') {
        output.push(`> ${truncateContent(message.content, CONTENT_PREVIEW_LENGTH)}`)
      } else if (message.role === 'assistant' && !message.isPartial) {
        output.push(truncateContent(message.content, RESPONSE_PREVIEW_LENGTH))
      }
    }

    // Update pod with the output preview
    if (output.length > 0) {
      // Keep only the most recent OUTPUT_LINES_PREVIEW_COUNT lines
      const previewOutput = output.slice(-OUTPUT_LINES_PREVIEW_COUNT)
      canvasStore.updatePod({
        ...pod,
        output: previewOutput,
      })
    }
  }
}

/**
 * Handle chat modal close
 */
const handleCloseChat = (): void => {
  canvasStore.selectPod(null)
}

/**
 * Initialize application on mount
 */
const initializeApp = async (): Promise<void> => {
  console.log('[App] Initializing application')

  // Initialize WebSocket connection
  chatStore.initWebSocket()

  // Wait for connection to establish
  await new Promise(resolve => setTimeout(resolve, CONNECTION_DELAY_MS))

  // Load pods from backend
  try {
    await canvasStore.loadPodsFromBackend()
    console.log('[App] Loaded existing pods from backend')

    // Load output styles and notes from backend
    try {
      await outputStyleStore.loadOutputStyles()
      console.log('[App] Output styles loaded')

      // Load notes from backend
      await outputStyleStore.loadNotesFromBackend()
      console.log('[App] Notes loaded from backend')

      // Rebuild missing notes from pods
      await outputStyleStore.rebuildNotesFromPods(canvasStore.pods)
      console.log('[App] Notes rebuilt from pods')
    } catch (e) {
      console.warn('[App] Failed to load output styles or notes:', e)
    }

    // Load chat history for all pods
    const podIds = canvasStore.pods.map(p => p.id)
    if (podIds.length > 0) {
      console.log('[App] Loading chat history for all pods')
      await chatStore.loadAllPodsHistory(podIds)
      console.log('[App] Chat history loaded successfully')

      // Sync loaded history to pod output
      syncHistoryToPodOutput()
    }
  } catch (error) {
    console.warn('[App] Initialization warning:', error)
    // App should still work with local pods/without history
  }
}

onMounted(() => {
  initializeApp()
})

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
      @update-pod="canvasStore.updatePod"
    />
  </div>
</template>
