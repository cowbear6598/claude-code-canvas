import { defineStore } from 'pinia'
import { websocketClient, createWebSocketRequest, WebSocketRequestEvents, WebSocketResponseEvents } from '@/services/websocket'
import { generateRequestId } from '@/services/utils'
import { useWebSocketErrorHandler } from '@/composables/useWebSocketErrorHandler'
import type { Message, ToolUseInfo, HistoryLoadingStatus, ToolUseStatus } from '@/types/chat'
import type {
  PodChatMessagePayload,
  PodChatToolUsePayload,
  PodChatToolResultPayload,
  PodChatCompletePayload,
  PodChatHistoryResultPayload,
  PodChatHistoryPayload,
  PodChatSendPayload,
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
      websocketClient.connect()
      this.registerListeners()
    },

    disconnectWebSocket(): void {
      this.unregisterListeners()
      websocketClient.disconnect()

      this.connectionStatus = 'disconnected'
      this.socketId = null
    },

    registerListeners(): void {
      websocketClient.on<ConnectionReadyPayload>(WebSocketResponseEvents.CONNECTION_READY, this.handleConnectionReady)
      websocketClient.on<PodChatMessagePayload>(WebSocketResponseEvents.POD_CHAT_MESSAGE, this.handleChatMessage)
      websocketClient.on<PodChatToolUsePayload>(WebSocketResponseEvents.POD_CHAT_TOOL_USE, this.handleChatToolUse)
      websocketClient.on<PodChatToolResultPayload>(WebSocketResponseEvents.POD_CHAT_TOOL_RESULT, this.handleChatToolResult)
      websocketClient.on<PodChatCompletePayload>(WebSocketResponseEvents.POD_CHAT_COMPLETE, this.handleChatComplete)
      websocketClient.on<PodChatHistoryResultPayload>(WebSocketResponseEvents.POD_CHAT_HISTORY_RESULT, this.handleChatHistoryResult)
      websocketClient.on<PodErrorPayload>(WebSocketResponseEvents.POD_ERROR, this.handleError)
    },

    unregisterListeners(): void {
      websocketClient.off<ConnectionReadyPayload>(WebSocketResponseEvents.CONNECTION_READY, this.handleConnectionReady)
      websocketClient.off<PodChatMessagePayload>(WebSocketResponseEvents.POD_CHAT_MESSAGE, this.handleChatMessage)
      websocketClient.off<PodChatToolUsePayload>(WebSocketResponseEvents.POD_CHAT_TOOL_USE, this.handleChatToolUse)
      websocketClient.off<PodChatToolResultPayload>(WebSocketResponseEvents.POD_CHAT_TOOL_RESULT, this.handleChatToolResult)
      websocketClient.off<PodChatCompletePayload>(WebSocketResponseEvents.POD_CHAT_COMPLETE, this.handleChatComplete)
      websocketClient.off<PodChatHistoryResultPayload>(WebSocketResponseEvents.POD_CHAT_HISTORY_RESULT, this.handleChatHistoryResult)
      websocketClient.off<PodErrorPayload>(WebSocketResponseEvents.POD_ERROR, this.handleError)
    },

    handleConnectionReady(payload: ConnectionReadyPayload): void {
      this.connectionStatus = 'connected'
      this.socketId = payload.socketId
    },

    async sendMessage(podId: string, content: string): Promise<void> {
      if (!this.isConnected) {
        throw new Error('WebSocket not connected')
      }

      if (!content.trim()) {
        return
      }

      this.addUserMessage(podId, content)

      websocketClient.emit<PodChatSendPayload>(WebSocketRequestEvents.POD_CHAT_SEND, {
        requestId: generateRequestId(),
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

      // Update POD output preview in pod store
      import('./pod/podStore').then(({ usePodStore }) => {
        const podStore = usePodStore()
        const pod = podStore.pods.find(p => p.id === podId)

        if (pod) {
          const truncatedContent = `> ${truncateContent(content, CONTENT_PREVIEW_LENGTH)}`
          podStore.updatePod({
            ...pod,
            output: [...pod.output, truncatedContent]
          })
        }
      })
    },

    // 處理串流訊息：建立新訊息或更新現有訊息內容
    handleChatMessage(payload: PodChatMessagePayload): void {
      const { podId, messageId, content, isPartial, role } = payload
      const messages = this.messagesByPodId.get(podId) || []

      const messageIndex = messages.findIndex(m => m.id === messageId)

      if (messageIndex === -1) {
        const newMessage: Message = {
          id: messageId,
          role: role || 'assistant',
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

        // Update POD output preview in pod store
        // Only update for assistant messages
        if (existingMessage.role === 'assistant') {
          // Dynamically import pod store to avoid circular dependency
          import('./pod/podStore').then(({ usePodStore }) => {
            const podStore = usePodStore()
            const pod = podStore.pods.find(p => p.id === podId)

            if (pod) {
              const truncatedContent = truncateContent(fullContent, RESPONSE_PREVIEW_LENGTH)
              podStore.updatePod({
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
      if (!websocketClient.isConnected.value) {
        this.connectionStatus = 'error'
      }

      if (payload.podId) {
        this.setTyping(payload.podId, false)
      }
    },

    setTyping(podId: string, isTyping: boolean): void {
      this.isTypingByPodId.set(podId, isTyping)
    },
      clearMessagesByPodIds(podIds: string[]): void {
      podIds.forEach(podId => {
        this.messagesByPodId.delete(podId)
        this.isTypingByPodId.delete(podId)
        this.historyLoadingStatus.delete(podId)
        this.historyLoadingError.delete(podId)
      })
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
        this.setHistoryLoadingStatus(podId, 'error')
        this.setHistoryLoadingError(podId, error)
        throw new Error(error)
      }

      this.setHistoryLoadingStatus(podId, 'loading')

      const { wrapWebSocketRequest } = useWebSocketErrorHandler()

      const response = await wrapWebSocketRequest(
        createWebSocketRequest<PodChatHistoryPayload, PodChatHistoryResultPayload>({
          requestEvent: WebSocketRequestEvents.POD_CHAT_HISTORY,
          responseEvent: WebSocketResponseEvents.POD_CHAT_HISTORY_RESULT,
          payload: {
            podId
          },
          timeout: HISTORY_LOAD_TIMEOUT_MS
        }),
        '載入聊天歷史失敗'
      )

      if (!response) {
        this.setHistoryLoadingStatus(podId, 'error')
        return
      }

      const messages = (response.messages || []).map(msg =>
        this.convertPersistedToMessage(msg)
      )
      this.setPodMessages(podId, messages)
      this.setHistoryLoadingStatus(podId, 'loaded')
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
