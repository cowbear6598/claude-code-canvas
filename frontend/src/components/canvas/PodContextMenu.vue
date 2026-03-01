<script setup lang="ts">
import { FolderOpen } from 'lucide-vue-next'
import { useWebSocketErrorHandler } from '@/composables/useWebSocketErrorHandler'
import { useToast } from '@/composables/useToast'
import { createWebSocketRequest, WebSocketRequestEvents, WebSocketResponseEvents } from '@/services/websocket'
import type { PodOpenDirectoryPayload } from '@/types/websocket/requests'
import type { PodDirectoryOpenedPayload } from '@/types/websocket/responses'
import { getActiveCanvasIdOrWarn } from '@/utils/canvasGuard'

interface Props {
  position: { x: number; y: number }
  podId: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
}>()

const { toast } = useToast()

const handleOpenDirectory = async (): Promise<void> => {
  const canvasId = getActiveCanvasIdOrWarn('PodContextMenu')
  if (!canvasId) return

  const { wrapWebSocketRequest } = useWebSocketErrorHandler()

  const response = await wrapWebSocketRequest(
    createWebSocketRequest<PodOpenDirectoryPayload, PodDirectoryOpenedPayload>({
      requestEvent: WebSocketRequestEvents.POD_OPEN_DIRECTORY,
      responseEvent: WebSocketResponseEvents.POD_DIRECTORY_OPENED,
      payload: {
        canvasId,
        podId: props.podId,
      },
    })
  )

  if (!response) {
    toast({
      title: '打開目錄失敗',
      description: '無法打開工作目錄，請稍後再試',
      variant: 'destructive',
    })
    return
  }

  emit('close')
}

const handleBackgroundClick = (): void => {
  emit('close')
}
</script>

<template>
  <div
    class="fixed inset-0 z-40"
    @click="handleBackgroundClick"
  >
    <div
      class="bg-card border border-doodle-ink rounded-md p-1 fixed z-50"
      :style="{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }"
      @click.stop
    >
      <button
        class="w-full flex items-center gap-2 px-2 py-1 rounded text-left text-xs hover:bg-secondary"
        @click="handleOpenDirectory"
      >
        <FolderOpen :size="14" />
        <span class="font-mono">打開工作目錄</span>
      </button>
    </div>
  </div>
</template>
