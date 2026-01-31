<script setup lang="ts">
import {computed, onMounted, onUnmounted, ref, watch} from 'vue'
import {useCanvasContext} from '@/composables/canvas/useCanvasContext'
import {websocketClient, WebSocketRequestEvents, WebSocketResponseEvents} from '@/services/websocket'
import type {PodStatusChangedPayload, PodJoinBatchPayload} from '@/types/websocket'
import AppHeader from '@/components/layout/AppHeader.vue'
import CanvasContainer from '@/components/canvas/CanvasContainer.vue'
import ChatModal from '@/components/chat/ChatModal.vue'
import {Toast} from '@/components/ui/toast'
import DisconnectOverlay from '@/components/ui/DisconnectOverlay.vue'
import {useCopyPaste} from '@/composables/canvas'
import {
  CONTENT_PREVIEW_LENGTH,
  RESPONSE_PREVIEW_LENGTH,
  OUTPUT_LINES_PREVIEW_COUNT,
} from '@/lib/constants'

const {
  podStore,
  viewportStore,
  chatStore,
  outputStyleStore,
  skillStore,
  subAgentStore,
  repositoryStore,
  commandStore,
  connectionStore
} = useCanvasContext()

const selectedPod = computed(() => podStore.selectedPod)

useCopyPaste()

const CONNECTION_DELAY_MS = 1000
const isInitialized = ref(false)
const isLoading = ref(false)

const truncateContent = (content: string, maxLength: number): string => {
  return content.length > maxLength
      ? `${content.slice(0, maxLength)}...`
      : content
}

const syncHistoryToPodOutput = (): void => {
  for (const pod of podStore.pods) {
    const messages = chatStore.getMessages(pod.id)

    if (messages.length === 0) continue

    const recentMessages = messages.slice(-OUTPUT_LINES_PREVIEW_COUNT * 2)

    const output: string[] = []
    for (const message of recentMessages) {
      if (message.role === 'user') {
        output.push(`> ${truncateContent(message.content, CONTENT_PREVIEW_LENGTH)}`)
      } else if (message.role === 'assistant' && !message.isPartial) {
        if (message.subMessages && message.subMessages.length > 0) {
          for (const sub of message.subMessages) {
            if (sub.content) {
              output.push(truncateContent(sub.content, RESPONSE_PREVIEW_LENGTH))
            }
          }
        } else {
          output.push(truncateContent(message.content, RESPONSE_PREVIEW_LENGTH))
        }
      }
    }

    if (output.length > 0) {
      const previewOutput = output.slice(-OUTPUT_LINES_PREVIEW_COUNT)
      podStore.updatePod({
        ...pod,
        output: previewOutput,
      })
    }
  }
}

const handleCloseChat = (): void => {
  podStore.selectPod(null)
}

const handlePodStatusChanged = (payload: PodStatusChangedPayload): void => {
  podStore.updatePodStatus(payload.podId, payload.status)
}

const loadAppData = async (): Promise<void> => {
  if (isInitialized.value || isLoading.value) {
    return
  }

  isLoading.value = true

  await podStore.loadPodsFromBackend()

  viewportStore.fitToAllPods(podStore.pods)

  const podIds = podStore.pods.map(p => p.id)
  if (podIds.length > 0) {
    websocketClient.emit<PodJoinBatchPayload>(WebSocketRequestEvents.POD_JOIN_BATCH, {podIds})
  }

  await Promise.all([
    async (): Promise<void> => {
      await outputStyleStore.loadOutputStyles()
      await outputStyleStore.loadNotesFromBackend()
      await outputStyleStore.rebuildNotesFromPods(podStore.pods)
    },
    async (): Promise<void> => {
      await skillStore.loadSkills()
      await skillStore.loadNotesFromBackend()
    },
    async (): Promise<void> => {
      await subAgentStore.loadItems()
      await subAgentStore.loadNotesFromBackend()
    },
    async (): Promise<void> => {
      await repositoryStore.loadRepositories()
      await repositoryStore.loadNotesFromBackend()
    },
    async (): Promise<void> => {
      await commandStore.loadCommands()
      await commandStore.loadNotesFromBackend()
    },
    connectionStore.loadConnectionsFromBackend(),
  ].map((fn): Promise<void> => typeof fn === 'function' ? fn() : fn))

  connectionStore.setupWorkflowListeners()

  if (podIds.length > 0) {
    await chatStore.loadAllPodsHistory(podIds)

    syncHistoryToPodOutput()
  }

  websocketClient.on<PodStatusChangedPayload>(WebSocketResponseEvents.POD_STATUS_CHANGED, handlePodStatusChanged)

  isInitialized.value = true
  isLoading.value = false
}

const initializeApp = async (): Promise<void> => {
  chatStore.initWebSocket()

  await new Promise(resolve => setTimeout(resolve, CONNECTION_DELAY_MS))

  await loadAppData()
}

watch(
    () => chatStore.connectionStatus,
    (newStatus) => {
      if (newStatus === 'connected' && !chatStore.allHistoryLoaded && !isInitialized.value) {
        loadAppData()
      }
    }
)

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
    <AppHeader/>

    <!-- Canvas -->
    <main class="flex-1 relative">
      <CanvasContainer/>
    </main>

    <!-- Chat Modal -->
    <ChatModal
        v-if="selectedPod"
        :pod="selectedPod"
        @close="handleCloseChat"
    />

    <!-- Toast -->
    <Toast/>

    <!-- Disconnect Overlay -->
    <DisconnectOverlay/>
  </div>
</template>
