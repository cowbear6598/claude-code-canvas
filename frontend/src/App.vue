<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { usePodStore, useViewportStore } from '@/stores/pod'
import { useChatStore } from '@/stores/chatStore'
import { useOutputStyleStore, useSkillStore, useSubAgentStore, useRepositoryStore, useCommandStore } from '@/stores/note'
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
const commandStore = useCommandStore()
const connectionStore = useConnectionStore()

const selectedPod = computed(() => podStore.selectedPod)

useCopyPaste()

const CONNECTION_DELAY_MS = 1000

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
        output.push(truncateContent(message.content, RESPONSE_PREVIEW_LENGTH))
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

const initializeApp = async (): Promise<void> => {
  chatStore.initWebSocket()

  await new Promise(resolve => setTimeout(resolve, CONNECTION_DELAY_MS))

  await podStore.loadPodsFromBackend()

  useViewportStore().fitToAllPods(podStore.pods)

  const podIds = podStore.pods.map(p => p.id)
  if (podIds.length > 0) {
    websocketClient.emit<PodJoinBatchPayload>(WebSocketRequestEvents.POD_JOIN_BATCH, { podIds })
  }

  await outputStyleStore.loadOutputStyles()
  await outputStyleStore.loadNotesFromBackend()
  await outputStyleStore.rebuildNotesFromPods(podStore.pods)

  await skillStore.loadSkills()
  await skillStore.loadNotesFromBackend()

  await subAgentStore.loadItems()
  await subAgentStore.loadNotesFromBackend()

  await repositoryStore.loadRepositories()
  await repositoryStore.loadNotesFromBackend()

  await commandStore.loadCommands()
  await commandStore.loadNotesFromBackend()

  await connectionStore.loadConnectionsFromBackend()

  connectionStore.setupWorkflowListeners()

  if (podIds.length > 0) {
    await chatStore.loadAllPodsHistory(podIds)

    syncHistoryToPodOutput()
  }

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
