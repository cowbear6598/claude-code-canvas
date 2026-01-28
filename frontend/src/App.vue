<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { usePodStore, useViewportStore } from '@/stores/pod'
import { useChatStore } from '@/stores/chatStore'
import { useOutputStyleStore, useSkillStore, useSubAgentStore, useRepositoryStore } from '@/stores/note'
import { useConnectionStore } from '@/stores/connectionStore'
import { websocketClient, WebSocketRequestEvents, WebSocketResponseEvents } from '@/services/websocket'
import type { PodStatusChangedPayload, PodJoinBatchPayload } from '@/types/websocket'
import AppHeader from '@/components/layout/AppHeader.vue'
import CanvasContainer from '@/components/canvas/CanvasContainer.vue'
import ChatModal from '@/components/chat/ChatModal.vue'
import { Toast } from '@/components/ui/toast'
import { useCopyPaste } from '@/composables/canvas'
import {
  CONTENT_PREVIEW_LENGTH,
  RESPONSE_PREVIEW_LENGTH,
  OUTPUT_LINES_PREVIEW_COUNT,
} from '@/lib/constants'

const podStore = usePodStore()
const chatStore = useChatStore()
const outputStyleStore = useOutputStyleStore()
const skillStore = useSkillStore()
const subAgentStore = useSubAgentStore()
const repositoryStore = useRepositoryStore()
const connectionStore = useConnectionStore()

const selectedPod = computed(() => podStore.selectedPod)

useCopyPaste()

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
  for (const pod of podStore.pods) {
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
      podStore.updatePod({
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
  podStore.selectPod(null)
}

/**
 * Handle POD status changed event
 */
const handlePodStatusChanged = (payload: PodStatusChangedPayload): void => {
  podStore.updatePodStatus(payload.podId, payload.status)
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
  await podStore.loadPodsFromBackend()

  // 縮放到全貌，讓所有 POD 都可見
  useViewportStore().fitToAllPods(podStore.pods)

  // Batch join all POD rooms
  const podIds = podStore.pods.map(p => p.id)
  if (podIds.length > 0) {
    websocketClient.emit<PodJoinBatchPayload>(WebSocketRequestEvents.POD_JOIN_BATCH, { podIds })
  }

  // Load output styles and notes from backend
  await outputStyleStore.loadOutputStyles()
  await outputStyleStore.loadNotesFromBackend()
  await outputStyleStore.rebuildNotesFromPods(podStore.pods)

  // Load skills and skill notes from backend
  await skillStore.loadSkills()
  await skillStore.loadNotesFromBackend()

  // Load subagents and subagent notes from backend
  await subAgentStore.loadItems()
  await subAgentStore.loadNotesFromBackend()

  // Load repositories and repository notes from backend
  await repositoryStore.loadRepositories()
  await repositoryStore.loadNotesFromBackend()

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

  // Setup POD status changed listener
  websocketClient.on<PodStatusChangedPayload>(WebSocketResponseEvents.POD_STATUS_CHANGED, handlePodStatusChanged)
}

onMounted(() => {
  initializeApp()
})

onUnmounted(() => {
  chatStore.disconnectWebSocket()
  websocketClient.off<PodStatusChangedPayload>(WebSocketResponseEvents.POD_STATUS_CHANGED, handlePodStatusChanged)
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

    <!-- Toast -->
    <Toast />
  </div>
</template>
