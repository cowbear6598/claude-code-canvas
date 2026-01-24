import { defineStore } from 'pinia'
import { websocketService } from '@/services/websocket'
import { generateRequestId } from '@/services/utils'
import type { Message, ToolUseInfo, HistoryLoadingStatus, ToolUseStatus } from '@/types/chat'
import type {
  PodChatMessagePayload,
  PodChatToolUsePayload,
  PodChatToolResultPayload,
  PodChatCompletePayload,
  PodChatHistoryResultPayload,
  PersistedMessage,
  PodErrorPayload,
  ConnectionReadyPayload
} from '@/types/websocket'
import { RESPONSE_PREVIEW_LENGTH, CONTENT_PREVIEW_LENGTH } from '@/lib/constants'

/**
 * WebSocket connection status types
 */
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

/**
 * Timeout duration for history loading (ms)
 */
const HISTORY_LOAD_TIMEOUT_MS = 10000

/**
 * Truncate content to specified length
 */
const truncateContent = (content: string, maxLength: number): string => {
  return content.length > maxLength
    ? `${content.slice(0, maxLength)}...`
    : content
}

interface ChatState {
  messagesByPodId: Map<string, Message[]>
  isTypingByPodId: Map<string, boolean>
  currentStreamingMessageId: string | null
  connectionStatus: ConnectionStatus
  socketId: string | null
  historyLoadingStatus: Map<string, HistoryLoadingStatus>
  historyLoadingError: Map<string, string>
  allHistoryLoaded: boolean
}

export const useChatStore = defineStore('chat', {
  state: (): ChatState => ({
    messagesByPodId: new Map(),
    isTypingByPodId: new Map(),
    currentStreamingMessageId: null,
    connectionStatus: 'disconnected',
    socketId: null,
    historyLoadingStatus: new Map(),
    historyLoadingError: new Map(),
    allHistoryLoaded: false
  }),

  getters: {
    getMessages: (state) => {
      return (podId: string): Message[] => {
        return state.messagesByPodId.get(podId) || []
      }
    },

    isTyping: (state) => {
      return (podId: string): boolean => {
        return state.isTypingByPodId.get(podId) || false
      }
    },

    isConnected: (state): boolean => {
      return state.connectionStatus === 'connected'
    },

    getHistoryLoadingStatus: (state) => {
      return (podId: string): HistoryLoadingStatus => {
        return state.historyLoadingStatus.get(podId) || 'idle'
      }
    },

    isHistoryLoading: (state) => {
      return (podId: string): boolean => {
        return state.historyLoadingStatus.get(podId) === 'loading'
      }
    },

    isAllHistoryLoaded: (state): boolean => {
      return state.allHistoryLoaded
    }
  },

  actions: {
    initWebSocket(): void {
      this.connectionStatus = 'connecting'
      websocketService.connect()
      this.registerListeners()
    },

    disconnectWebSocket(): void {
      this.unregisterListeners()
      websocketService.disconnect()

      this.connectionStatus = 'disconnected'
      this.socketId = null
    },

    registerListeners(): void {
      websocketService.onConnectionReady(this.handleConnectionReady)
      websocketService.onChatMessage(this.handleChatMessage)
      websocketService.onChatToolUse(this.handleChatToolUse)
      websocketService.onChatToolResult(this.handleChatToolResult)
      websocketService.onChatComplete(this.handleChatComplete)
      websocketService.onChatHistoryResult(this.handleChatHistoryResult)
      websocketService.onError(this.handleError)
    },

    unregisterListeners(): void {
      websocketService.offConnectionReady(this.handleConnectionReady)
      websocketService.offChatMessage(this.handleChatMessage)
      websocketService.offChatToolUse(this.handleChatToolUse)
      websocketService.offChatToolResult(this.handleChatToolResult)
      websocketService.offChatComplete(this.handleChatComplete)
      websocketService.offChatHistoryResult(this.handleChatHistoryResult)
      websocketService.offError(this.handleError)
    },

    handleConnectionReady(payload: ConnectionReadyPayload): void {
      this.connectionStatus = 'connected'
      this.socketId = payload.socketId
    },

    async sendMessage(podId: string, content: string): Promise<void> {
      if (!this.isConnected) {
        console.error('[ChatStore] Cannot send message, not connected')
        throw new Error('WebSocket not connected')
      }

      if (!content.trim()) {
        return
      }

      this.addUserMessage(podId, content)

      const requestId = generateRequestId()

      websocketService.podChatSend({
        requestId,
        podId,
        message: content
      })

      this.setTyping(podId, true)
    },

    addUserMessage(podId: string, content: string): void {
      const userMessage: Message = {
        id: generateRequestId(),
        role: 'user',
        content,
        timestamp: new Date().toISOString()
      }

      const messages = this.messagesByPodId.get(podId) || []
      this.messagesByPodId.set(podId, [...messages, userMessage])

      // Update POD output preview in canvas store
      import('./canvasStore').then(({ useCanvasStore }) => {
        const canvasStore = useCanvasStore()
        const pod = canvasStore.pods.find(p => p.id === podId)

        if (pod) {
          const truncatedContent = `> ${truncateContent(content, CONTENT_PREVIEW_LENGTH)}`
          canvasStore.updatePod({
            ...pod,
            output: [...pod.output, truncatedContent]
          })
        }
      })
    },

    // 處理串流訊息：建立新訊息或更新現有訊息內容
    handleChatMessage(payload: PodChatMessagePayload): void {
      const { podId, messageId, content, isPartial } = payload
      const messages = this.messagesByPodId.get(podId) || []

      const messageIndex = messages.findIndex(m => m.id === messageId)

      if (messageIndex === -1) {
        const newMessage: Message = {
          id: messageId,
          role: 'assistant',
          content,
          isPartial,
          timestamp: new Date().toISOString()
        }
        this.messagesByPodId.set(podId, [...messages, newMessage])
        this.currentStreamingMessageId = messageId

        if (isPartial) {
          this.setTyping(podId, true)
        }
        return
      }

      const updatedMessages = [...messages]
      const existingMessage = updatedMessages[messageIndex]
      if (existingMessage) {
        updatedMessages[messageIndex] = {
          ...existingMessage,
          content,
          isPartial
        }
        this.messagesByPodId.set(podId, updatedMessages)
      }

      if (isPartial) {
        this.setTyping(podId, true)
      }
    },

    // 記錄工具使用狀態，追蹤多個工具的執行進度
    handleChatToolUse(payload: PodChatToolUsePayload): void {
      const { podId, messageId, toolName, input } = payload
      const messages = this.messagesByPodId.get(podId) || []

      const messageIndex = messages.findIndex(m => m.id === messageId)
      if (messageIndex === -1) {
        return
      }

      const updatedMessages = [...messages]
      const message = updatedMessages[messageIndex]
      if (!message) return

      const toolUse = message.toolUse || []
      const toolIndex = toolUse.findIndex(t => t.toolName === toolName)

      const toolUseInfo: ToolUseInfo = {
        toolName,
        input,
        status: 'running' as ToolUseStatus
      }

      const updatedToolUse = toolIndex === -1
        ? [...toolUse, toolUseInfo]
        : toolUse.map((tool, idx) => idx === toolIndex ? toolUseInfo : tool)

      updatedMessages[messageIndex] = {
        ...message,
        toolUse: updatedToolUse
      }

      this.messagesByPodId.set(podId, updatedMessages)
    },

    // 更新工具執行結果，標記為已完成
    handleChatToolResult(payload: PodChatToolResultPayload): void {
      const { podId, messageId, toolName, output } = payload
      const messages = this.messagesByPodId.get(podId) || []

      const messageIndex = messages.findIndex(m => m.id === messageId)
      if (messageIndex === -1) {
        return
      }

      const updatedMessages = [...messages]
      const message = updatedMessages[messageIndex]
      if (!message?.toolUse) return

      const updatedToolUse = message.toolUse.map(tool =>
        tool.toolName === toolName
          ? { ...tool, output, status: 'completed' as ToolUseStatus }
          : tool
      )

      updatedMessages[messageIndex] = {
        ...message,
        toolUse: updatedToolUse
      }

      this.messagesByPodId.set(podId, updatedMessages)
    },

    handleChatComplete(payload: PodChatCompletePayload): void {
      const { podId, messageId, fullContent } = payload
      const messages = this.messagesByPodId.get(podId) || []

      const messageIndex = messages.findIndex(m => m.id === messageId)
      if (messageIndex === -1) {
        this.setTyping(podId, false)

        if (this.currentStreamingMessageId === messageId) {
          this.currentStreamingMessageId = null
        }
        return
      }

      const updatedMessages = [...messages]
      const existingMessage = updatedMessages[messageIndex]
      if (existingMessage) {
        updatedMessages[messageIndex] = {
          ...existingMessage,
          content: fullContent,
          isPartial: false
        }
        this.messagesByPodId.set(podId, updatedMessages)

        // Update POD output preview in canvas store
        // Only update for assistant messages
        if (existingMessage.role === 'assistant') {
          // Dynamically import canvas store to avoid circular dependency
          import('./canvasStore').then(({ useCanvasStore }) => {
            const canvasStore = useCanvasStore()
            const pod = canvasStore.pods.find(p => p.id === podId)

            if (pod) {
              const truncatedContent = truncateContent(fullContent, RESPONSE_PREVIEW_LENGTH)
              canvasStore.updatePod({
                ...pod,
                output: [...pod.output, truncatedContent]
              })
            }
          })
        }
      }

      this.setTyping(podId, false)

      if (this.currentStreamingMessageId === messageId) {
        this.currentStreamingMessageId = null
      }
    },

    handleError(payload: PodErrorPayload): void {
      console.error('[ChatStore] Error:', payload)

      if (!websocketService.isConnected.value) {
        this.connectionStatus = 'error'
      }

      if (payload.podId) {
        this.setTyping(payload.podId, false)
      }
    },

    setTyping(podId: string, isTyping: boolean): void {
      this.isTypingByPodId.set(podId, isTyping)
    },

    clearMessages(podId: string): void {
      this.messagesByPodId.delete(podId)
      this.isTypingByPodId.delete(podId)
    },

    convertPersistedToMessage(persistedMessage: PersistedMessage): Message {
      return {
        id: persistedMessage.id,
        role: persistedMessage.role,
        content: persistedMessage.content,
        timestamp: persistedMessage.timestamp,
        isPartial: false
      }
    },

    setPodMessages(podId: string, messages: Message[]): void {
      this.messagesByPodId.set(podId, messages)
    },

    setHistoryLoadingStatus(podId: string, status: HistoryLoadingStatus): void {
      this.historyLoadingStatus.set(podId, status)
    },

    setHistoryLoadingError(podId: string, error: string): void {
      this.historyLoadingError.set(podId, error)
    },

    // 載入單一 Pod 的聊天歷史，使用 Promise 包裝 WebSocket 請求/響應流程
    async loadPodChatHistory(podId: string): Promise<void> {
      const currentStatus = this.historyLoadingStatus.get(podId)
      if (currentStatus === 'loaded' || currentStatus === 'loading') {
        return
      }

      if (!this.isConnected) {
        const error = 'WebSocket not connected'
        console.error(`[ChatStore] Cannot load history: ${error}`)
        this.setHistoryLoadingStatus(podId, 'error')
        this.setHistoryLoadingError(podId, error)
        throw new Error(error)
      }

      this.setHistoryLoadingStatus(podId, 'loading')

      return new Promise<void>((resolve, reject) => {
        const requestId = generateRequestId()
        let timeoutId: ReturnType<typeof setTimeout>

        const handleHistoryResult = (payload: PodChatHistoryResultPayload): void => {
          if (payload.requestId !== requestId) return

          websocketService.offChatHistoryResult(handleHistoryResult)
          clearTimeout(timeoutId)

          if (payload.success) {
            const messages = (payload.messages || []).map(msg =>
              this.convertPersistedToMessage(msg)
            )
            this.setPodMessages(podId, messages)
            this.setHistoryLoadingStatus(podId, 'loaded')
            resolve()
          } else {
            const error = payload.error || 'Unknown error'
            console.error(`[ChatStore] Failed to load history for pod ${podId}:`, error)
            this.setHistoryLoadingStatus(podId, 'error')
            this.setHistoryLoadingError(podId, error)
            reject(new Error(error))
          }
        }

        timeoutId = setTimeout(() => {
          websocketService.offChatHistoryResult(handleHistoryResult)
          const error = 'History load timeout'
          console.error(`[ChatStore] ${error} for pod: ${podId}`)
          this.setHistoryLoadingStatus(podId, 'error')
          this.setHistoryLoadingError(podId, error)
          reject(new Error(error))
        }, HISTORY_LOAD_TIMEOUT_MS)

        websocketService.onChatHistoryResult(handleHistoryResult)

        websocketService.podChatHistory({
          requestId,
          podId
        })
      })
    },

    // 平行載入所有 Pods 的聊天歷史，使用 Promise.allSettled 確保部分失敗不會影響其他
    async loadAllPodsHistory(podIds: string[]): Promise<void> {
      if (podIds.length === 0) {
        this.allHistoryLoaded = true
        return
      }
        await Promise.allSettled(
            podIds.map(podId => this.loadPodChatHistory(podId))
        );

        this.allHistoryLoaded = true
    },

    handleChatHistoryResult(_: PodChatHistoryResultPayload): void {
      // Chat history result received
    }
  }
})
