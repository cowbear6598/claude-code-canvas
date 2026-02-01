<script setup lang="ts">
import {computed, onMounted, onUnmounted, ref, watch} from 'vue'
import {useCanvasContext} from '@/composables/canvas/useCanvasContext'
import {websocketClient, WebSocketRequestEvents, WebSocketResponseEvents} from '@/services/websocket'
import type {PodStatusChangedPayload, PodJoinBatchPayload, TriggerFiredPayload} from '@/types/websocket'
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
import {truncateContent} from '@/stores/chat/chatUtils'

const {
  podStore,
  viewportStore,
  chatStore,
  outputStyleStore,
  skillStore,
  subAgentStore,
  repositoryStore,
  commandStore,
  connectionStore,
  triggerStore
} = useCanvasContext()

const selectedPod = computed(() => podStore.selectedPod)

useCopyPaste()

const isInitialized = ref(false)
const isLoading = ref(false)
let loadingAbortController: AbortController | null = null

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

const handleTriggerFired = (payload: TriggerFiredPayload): void => {
  triggerStore.handleTriggerFired(payload)
}

const loadAppData = async (): Promise<void> => {
  if (isInitialized.value || isLoading.value) {
    return
  }

  if (loadingAbortController) {
    loadingAbortController.abort()
  }

  loadingAbortController = new AbortController()
  const currentAbortController = loadingAbortController

  isLoading.value = true

  try {
    if (currentAbortController.signal.aborted) return

    await podStore.loadPodsFromBackend()

    if (currentAbortController.signal.aborted) return

    viewportStore.fitToAllPods(podStore.pods)

    const podIds = podStore.pods.map(p => p.id)
    if (podIds.length > 0) {
      websocketClient.emit<PodJoinBatchPayload>(WebSocketRequestEvents.POD_JOIN_BATCH, {podIds})
    }

    if (currentAbortController.signal.aborted) return

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
      triggerStore.loadTriggersFromBackend(),
    ].map((fn): Promise<void> => typeof fn === 'function' ? fn() : fn))

    if (currentAbortController.signal.aborted) return

    connectionStore.setupWorkflowListeners()

    if (podIds.length > 0) {
      await chatStore.loadAllPodsHistory(podIds)

      if (currentAbortController.signal.aborted) return

      syncHistoryToPodOutput()
    }

    websocketClient.on<PodStatusChangedPayload>(WebSocketResponseEvents.POD_STATUS_CHANGED, handlePodStatusChanged)
    websocketClient.on<TriggerFiredPayload>(WebSocketResponseEvents.TRIGGER_FIRED, handleTriggerFired)

    isInitialized.value = true
  } finally {
    if (currentAbortController === loadingAbortController) {
      isLoading.value = false
      loadingAbortController = null
    }
  }
}

const initializeApp = async (): Promise<void> => {
  chatStore.initWebSocket()
}

watch(
    () => websocketClient.isConnected.value,
    (connected) => {
      if (connected) {
        chatStore.unregisterListeners()
        chatStore.registerListeners()
      }
    },
    { flush: 'sync' }
)

watch(
    () => chatStore.connectionStatus,
    (newStatus) => {
      if (newStatus === 'connected' && !chatStore.allHistoryLoaded && !isInitialized.value) {
        loadAppData()
      }

      if (newStatus === 'disconnected') {
        websocketClient.off<PodStatusChangedPayload>(WebSocketResponseEvents.POD_STATUS_CHANGED, handlePodStatusChanged)
        websocketClient.off<TriggerFiredPayload>(WebSocketResponseEvents.TRIGGER_FIRED, handleTriggerFired)
        connectionStore.cleanupWorkflowListeners()
        isInitialized.value = false
        isLoading.value = false

        if (loadingAbortController) {
          loadingAbortController.abort()
          loadingAbortController = null
        }
      }
    }
)

onMounted(() => {
  initializeApp()
})

onUnmounted(() => {
  if (loadingAbortController) {
    loadingAbortController.abort()
    loadingAbortController = null
  }

  chatStore.disconnectWebSocket()
  websocketClient.off<PodStatusChangedPayload>(WebSocketResponseEvents.POD_STATUS_CHANGED, handlePodStatusChanged)
  websocketClient.off<TriggerFiredPayload>(WebSocketResponseEvents.TRIGGER_FIRED, handleTriggerFired)
  connectionStore.cleanupWorkflowListeners()
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
