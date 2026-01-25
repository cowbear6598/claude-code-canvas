<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useCanvasStore } from '@/stores/canvasStore'
import { useChatStore } from '@/stores/chatStore'
import { useOutputStyleStore } from '@/stores/outputStyleStore'
import { useSkillStore } from '@/stores/skillStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { websocketService } from '@/services/websocket'
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
const skillStore = useSkillStore()
const connectionStore = useConnectionStore()

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
  // Initialize WebSocket connection
  chatStore.initWebSocket()

  // Wait for connection to establish
  await new Promise(resolve => setTimeout(resolve, CONNECTION_DELAY_MS))

  // Load pods from backend
  await canvasStore.loadPodsFromBackend()

  // Batch join all POD rooms
  const podIds = canvasStore.pods.map(p => p.id)
  if (podIds.length > 0) {
    websocketService.podJoinBatch({ podIds })
  }

  // Load output styles and notes from backend
  await outputStyleStore.loadOutputStyles()
  await outputStyleStore.loadNotesFromBackend()
  await outputStyleStore.rebuildNotesFromPods(canvasStore.pods)

  // Load skills and skill notes from backend
  await skillStore.loadSkills()
  await skillStore.loadNotesFromBackend()

  // Load connections from backend
  await connectionStore.loadConnectionsFromBackend()

  // Setup workflow event listeners
  connectionStore.setupWorkflowListeners()

  // Load chat history for all pods
  if (podIds.length > 0) {
    await chatStore.loadAllPodsHistory(podIds)

    // Sync loaded history to pod output
    syncHistoryToPodOutput()
  }
}

onMounted(() => {
  initializeApp()
})

onUnmounted(() => {
  chatStore.disconnectWebSocket()
})
</script>

<template>
  <div class="h-screen bg-background overflow-hidden flex flex-col">
    <!-- Header -->
    <AppHeader />

    <!-- Canvas -->
    <main class="flex-1 relative">
      <CanvasContainer />
    </main>

    <!-- Chat Modal -->
    <ChatModal
      v-if="selectedPod"
      :pod="selectedPod"
      @close="handleCloseChat"
    />
  </div>
</template>
